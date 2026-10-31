-- Additive repairs using existing tables. All privileged RPCs are server-only.
alter table public.delivery_requests add column if not exists order_messages jsonb not null default '[]'::jsonb;
alter table public.support_tickets add column if not exists replies jsonb not null default '[]'::jsonb;
-- Prevent a browser from forging support-team replies during ticket creation.
revoke insert on public.support_tickets from authenticated;
grant insert (user_id,subject,message,status) on public.support_tickets to authenticated;

create or replace function public.append_customer_thread(p_kind text,p_id uuid,p_actor uuid,p_key uuid,p_body text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare messages jsonb; allowed boolean; staff boolean; sender text;
begin
 if p_actor is null or p_key is null or char_length(trim(p_body)) not between 1 and 4000 then raise exception 'Invalid message'; end if;
 select role='admin' into staff from public.users where id=p_actor;
 if p_kind='support' then
  select replies,(user_id=p_actor or coalesce(staff,false)) into messages,allowed from public.support_tickets where id=p_id for update;
  sender:=case when staff then 'Support team' else 'Customer' end;
 elsif p_kind='order' then
  select order_messages,((customer_id=p_actor or driver_id=p_actor) and driver_id is not null and status in ('accepted','collected','in_transit')),
   case when driver_id=p_actor then 'Driver' else 'Customer' end into messages,allowed,sender
   from public.delivery_requests where id=p_id for update;
 else raise exception 'Invalid thread'; end if;
 if not coalesce(allowed,false) then raise exception 'Thread unavailable'; end if;
 if exists(select 1 from jsonb_array_elements(messages) m where m->>'id'=p_key::text) then return messages; end if;
 messages:=messages||jsonb_build_array(jsonb_build_object('id',p_key,'sender_id',p_actor,'sender',sender,'body',trim(p_body),'created_at',now()));
 if p_kind='support' then update public.support_tickets set replies=messages,status='open' where id=p_id;
 else update public.delivery_requests set order_messages=messages where id=p_id; end if;
 return messages;
end $$;
revoke all on function public.append_customer_thread(text,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.append_customer_thread(text,uuid,uuid,uuid,text) to service_role;

create or replace function public.customer_payment_records(p_customer uuid,p_page integer default 1,p_size integer default 10,p_refunds boolean default false)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 with records as (
 select p.id,p.delivery_id,p.status,p.created_at,p.payment_method,
 case when p.payment_method='wallet' then coalesce((select jsonb_agg(jsonb_build_object('key',w.id,'amount',w.amount,'state','succeeded')) from public.wallet_transactions w where w.delivery_id=d.id and w.user_id=p_customer and w.type='cashback' and w.amount>0),'[]'::jsonb) else coalesce(p.refund_jobs,'[]'::jsonb) end refund_jobs,
 d.tracking_number tracking,case when d.service_type='buy_for_me' then 'Buy for Me' else 'Collect & Deliver' end service,
 case when p.payment_method='wallet' and d.service_type='buy_for_me' then d.price+coalesce(d.max_spend_approved,0) else p.amount end amount,
 case when d.service_type='buy_for_me' then coalesce(d.max_spend_approved,0) else 0 end "shoppingFunds",d.price "serviceFees",
 case when d.shopping_hold_settled_at is not null then d.actual_items_total end "actualShopping",
 case when d.shopping_hold_settled_at is not null then greatest(0,coalesce(d.max_spend_approved,0)-d.actual_items_total) end "unusedShopping"
 from public.payments p join public.delivery_requests d on d.id=p.delivery_id
 where d.customer_id=p_customer
 ), calculated as (
 select r.*,case when jsonb_array_length(refund_jobs)>0 then coalesce((select sum((j->>'amount')::numeric) from jsonb_array_elements(refund_jobs) j where j->>'state'='succeeded'),0)
 when status='refunded' then amount else 0 end returned from records r
 ), filtered as (select * from calculated where not p_refunds or jsonb_array_length(refund_jobs)>0 or status in ('refunded','partially_refunded')),
 page as (select *,greatest(0,amount-returned) "retainedTotal" from filtered order by created_at desc nulls last,id desc limit greatest(1,least(coalesce(p_size,10),50)) offset (greatest(1,coalesce(p_page,1))-1)*greatest(1,least(coalesce(p_size,10),50)))
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'totalCount',(select count(*) from filtered),
 'paidMonth',(select coalesce(sum(amount),0) from calculated where status in ('paid','released','refunded','partially_refunded') and created_at >= (date_trunc('month',now() at time zone 'Europe/London') at time zone 'Europe/London')),
 'refunds',(select coalesce(sum(returned),0) from calculated));
$$;
revoke all on function public.customer_payment_records(uuid,integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.customer_payment_records(uuid,integer,integer,boolean) to service_role;

-- Store leases on the existing user row; storage metadata remains read-only.
-- Checkout and cleanup lock the same user row before inspecting a photo.
alter table public.users add column if not exists order_photo_leases jsonb not null default '{}'::jsonb;
create or replace function public.lease_customer_photos(p_user uuid,p_paths text[])
returns boolean language plpgsql security invoker set search_path=public,storage,pg_temp as $$
declare path text; leases jsonb;
begin
 if p_user is null or cardinality(p_paths)>100 then raise exception 'Invalid photo list'; end if;
 select order_photo_leases into leases from public.users where id=p_user for update;
 if not found then raise exception 'Photo owner unavailable'; end if;
 foreach path in array p_paths loop
  if split_part(path,'/',1)<>p_user::text then raise exception 'Invalid photo owner'; end if;
  if coalesce((leases->path->>'cleanup_pending')::boolean,false) or not exists(select 1 from storage.objects where bucket_id='delivery-item-photos' and name=path) then raise exception 'Photo no longer available'; end if;
  leases:=jsonb_set(leases,array[path],jsonb_build_object('until',now()+interval '24 hours'));
 end loop;
 update public.users set order_photo_leases=leases where id=p_user;
 return true;
end $$;
revoke all on function public.lease_customer_photos(uuid,text[]) from public,anon,authenticated;
grant execute on function public.lease_customer_photos(uuid,text[]) to service_role;

create or replace function public.claim_abandoned_customer_photo(p_user uuid,p_path text,p_url text,p_min_age_hours integer default 48)
returns boolean language plpgsql security invoker set search_path=public,storage,pg_temp as $$
declare leases jsonb;
begin
 if p_user is null or split_part(p_path,'/',1)<>p_user::text or p_path like '%/receipts/%' or p_path like '%/substitutions/%' then return false; end if;
 select order_photo_leases into leases from public.users where id=p_user for update;
 if not found or (leases->p_path->>'until')::timestamptz>now() then return false; end if;
 if not exists(select 1 from storage.objects where bucket_id='delivery-item-photos' and name=p_path and created_at<=now()-make_interval(hours=>greatest(0,p_min_age_hours))) then return false; end if;
 if exists(select 1 from public.delivery_requests d where p_url=any(coalesce(d.item_photo_urls,'{}'::text[])) or d.receipt_url=p_url)
 or exists(select 1 from public.shopping_items i where i.photo_url=p_url)
 or exists(select 1 from public.shopping_substitutions s where s.delivery_id is not null and s.photo_url=p_url)
 or exists(select 1 from public.payments p where position(to_jsonb(p_url)::text in p.booking_draft::text)>0) then return false; end if;
 update public.users set order_photo_leases=jsonb_set(leases,array[p_path],'{"cleanup_pending":true}'::jsonb) where id=p_user;
 return true;
end $$;
revoke all on function public.claim_abandoned_customer_photo(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.claim_abandoned_customer_photo(uuid,text,text,integer) to service_role;

-- Validate changes even when made through the browser's allowed profile columns.
create or replace function public.validate_customer_profile_change()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if new.full_name is distinct from old.full_name then
  if new.full_name is null or char_length(trim(new.full_name)) not between 1 and 100 or new.full_name ~ '[[:cntrl:]]' then raise exception 'Enter a valid full name'; end if;
  new.full_name:=regexp_replace(trim(new.full_name),'\s+',' ','g');
 end if;
 if new.phone is distinct from old.phone then
  new.phone:=nullif(regexp_replace(trim(new.phone),'[[:space:]()-]','','g'),'');
  if new.phone is not null and new.phone !~ '^\+?[0-9]{7,15}$' then raise exception 'Enter a valid phone number'; end if;
 end if;
 return new;
end $$;
revoke all on function public.validate_customer_profile_change() from public,anon,authenticated;
drop trigger if exists validate_customer_profile_change on public.users;
create trigger validate_customer_profile_change before update of full_name,phone on public.users for each row execute function public.validate_customer_profile_change();

-- Sweep candidates in one database round trip; old paid photos cannot starve
-- later abandoned uploads. Deletion remains bounded to twenty files per run.
create or replace function public.claim_abandoned_customer_photos(p_user uuid,p_prefix text)
returns text[] language plpgsql security invoker set search_path=public,storage,pg_temp as $$
declare item record; claimed text[]:='{}'; scanned integer:=0;
begin
 if p_user is null or p_prefix is null then return claimed; end if;
 for item in select name from storage.objects where bucket_id='delivery-item-photos'
  and name ~ ('^'||p_user::text||'/(bfm-items/)?[^/]+$')
  and created_at<now()-interval '48 hours' order by created_at,name limit 2000
 loop
  if public.claim_abandoned_customer_photo(p_user,item.name,p_prefix||item.name,48) then claimed:=array_append(claimed,item.name); end if;
  exit when cardinality(claimed)>=20;
 end loop;
 return claimed;
end $$;
revoke all on function public.claim_abandoned_customer_photos(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_abandoned_customer_photos(uuid,text) to service_role;

-- Live customer coordinates belong to one active job and expire when updates stop.
drop policy if exists "drivers read assigned customer location" on public.customer_locations;
create policy "drivers read assigned customer location" on public.customer_locations for select to authenticated using (
 updated_at>now()-interval '45 seconds' and exists(select 1 from public.delivery_requests d
 where d.id=customer_locations.delivery_id and d.customer_id=customer_locations.customer_id
 and d.driver_id=(select auth.uid()) and d.status in ('accepted','collected','in_transit','picked_up'))
);
