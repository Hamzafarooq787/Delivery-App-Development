-- Initialize new identities once. Existing role, approval and profile data are never replaced.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare initial_role text:=case when new.raw_user_meta_data->>'role'='driver' then 'driver' else 'customer' end;
begin
 insert into users(id,role,full_name,phone,email) values(new.id,initial_role,left(coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),160),left(new.raw_user_meta_data->>'phone',40),new.email) on conflict(id) do nothing;
 if initial_role='driver' then insert into driver_profiles(id,status) values(new.id,'pending') on conflict(id) do nothing;
 else insert into customer_profiles(id,default_address) values(new.id,left(new.raw_user_meta_data->>'address',1000)) on conflict(id) do nothing;end if;
 return new;
end;$$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
-- A device belongs to one account at a time, even under concurrent registration.
delete from public.user_notification_tokens a using public.user_notification_tokens b where a.fcm_token=b.fcm_token and (coalesce(a.updated_at,a.created_at),a.id)<(coalesce(b.updated_at,b.created_at),b.id);
create unique index if not exists notification_device_owner on public.user_notification_tokens(fcm_token);
revoke insert,update on public.user_notification_tokens from anon,authenticated;
create or replace function public.claim_notification_device(p_user uuid,p_token text,p_device text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_token is null or length(p_token) not between 10 and 4096 or p_token ~ '[[:space:][:cntrl:]]' or p_device is null or p_device not in ('web','mobile','desktop') then raise exception 'invalid_device';end if;
 perform 1 from users where id=p_user and account_status='active' for update;
 if not found then raise exception 'account_unavailable';end if;
 insert into user_notification_tokens(user_id,fcm_token,device_type,updated_at) values(p_user,p_token,p_device,now()) on conflict(fcm_token) do update set user_id=excluded.user_id,device_type=excluded.device_type,updated_at=excluded.updated_at;
end;$$;
revoke all on function public.claim_notification_device(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_notification_device(uuid,text,text) to service_role;
-- Reuse the existing private rate bucket store; never change geocoder buckets.
create or replace function public.claim_push_test(p_user uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare buckets jsonb;key text:='push.'||p_user::text;stamp numeric:=extract(epoch from now());previous numeric;
begin
 if not exists(select 1 from users where id=p_user and account_status='active') then return false;end if;
 select geocode_rate_buckets into buckets from surge_pricing_settings where id=true for update;
 if not found then return false;end if;
 previous:=(buckets->>key)::numeric;
 if previous is not null and stamp-previous<60 then return false;end if;
 select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) into buckets from jsonb_each(coalesce(buckets,'{}')) e where case when e.key like 'push.%' then (e.value#>>'{}')::numeric>stamp-3600 else true end;
 update surge_pricing_settings set geocode_rate_buckets=jsonb_set(buckets,array[key],to_jsonb(stamp)) where id=true;
 return true;
end;$$;
revoke all on function public.claim_push_test(uuid) from public,anon,authenticated;
grant execute on function public.claim_push_test(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.append_customer_thread(p_kind text, p_id uuid, p_actor uuid, p_key uuid, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare messages jsonb; allowed boolean; staff boolean; sender text;
begin
 if p_actor is null or p_key is null or char_length(trim(p_body)) not between 1 and 4000 then raise exception 'Invalid message'; end if;
 select role='admin' into staff from public.users where id=p_actor and account_status='active';
 if not found then raise exception 'account_unavailable';end if;
 if staff and not godrop_private.admin_has_scope(p_actor,'support') then raise exception 'support_permission_required';end if;
 if p_kind='support' then
  select replies,(user_id=p_actor or coalesce(staff,false)) into messages,allowed from public.support_tickets where id=p_id for update;
  sender:=case when staff then 'Support team' when (select role from users where id=p_actor)='driver' then 'Driver' else 'Customer' end;
 elsif p_kind='order' then
  select order_messages,((customer_id=p_actor or driver_id=p_actor) and driver_id is not null and status in ('accepted','collected','picked_up','in_transit')),
   case when driver_id=p_actor then 'Driver' else 'Customer' end into messages,allowed,sender
   from public.delivery_requests where id=p_id for update;
 else raise exception 'Invalid thread'; end if;
 if not coalesce(allowed,false) then raise exception 'Thread unavailable'; end if;
 if exists(select 1 from jsonb_array_elements(messages) m where m->>'id'=p_key::text) then return messages; end if;
 messages:=messages||jsonb_build_array(jsonb_build_object('id',p_key,'sender_id',p_actor,'sender',sender,'body',trim(p_body),'created_at',now()));
 if p_kind='support' then update public.support_tickets set replies=messages,status='open' where id=p_id;
 else update public.delivery_requests set order_messages=messages where id=p_id; end if;
 return messages;
end $function$
;
revoke all on function public.append_customer_thread(text,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.append_customer_thread(text,uuid,uuid,uuid,text) to service_role;
