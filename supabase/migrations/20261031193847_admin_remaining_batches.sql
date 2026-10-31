-- Server-only operational controls and durable administrative evidence.
create schema if not exists godrop_private;
revoke all on schema godrop_private from public,anon;
grant usage on schema godrop_private to authenticated,service_role;
alter table public.surge_pricing_settings add column operational_settings jsonb not null default '{}',add column integration_health jsonb not null default '{}';
revoke all(operational_settings,integration_health) on public.surge_pricing_settings from public,anon,authenticated;
alter table public.users add column account_status text not null default 'active' check(account_status in ('active','suspended','archived')),
 add column admin_access jsonb not null default '{"owner":false,"scopes":[]}';
create or replace view public.admin_customer_accounts with(security_invoker=true) as
 select u.* from public.users u where u.role='customer' or exists(select 1 from public.customer_profiles c where c.id=u.id) or exists(select 1 from public.delivery_requests d where d.customer_id=u.id);
revoke all on public.admin_customer_accounts from public,anon,authenticated;
grant select on public.admin_customer_accounts to service_role;
update public.users set admin_access='{"owner":true,"scopes":["operations","finance","support","settings","marketing"]}' where role='admin';
revoke insert(account_status,admin_access),update(account_status,admin_access) on public.users from public,anon,authenticated;
-- A previous table-wide grant must not bypass protected columns.
revoke update,insert on public.users from anon,authenticated;
grant update(full_name,phone,marketing_email_opt_in,marketing_push_opt_in,marketing_consent_updated_at,service_push_enabled) on public.users to authenticated;
grant select(account_status,admin_access) on public.users to authenticated;
create table public.admin_audit_log(id uuid primary key default gen_random_uuid(),actor_id uuid references public.users(id),event text not null,entity text not null,details jsonb not null default '{}',created_at timestamptz not null default now());
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public,anon,authenticated;
grant select,insert on public.admin_audit_log to service_role;
create index admin_audit_entity_idx on public.admin_audit_log(entity,created_at desc,id);
create index admin_audit_recent_idx on public.admin_audit_log(created_at desc,id);
create or replace function godrop_private.admin_has_scope(p_actor uuid,p_scope text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from users u where u.id=p_actor and u.role='admin' and u.account_status='active' and
 (coalesce((u.admin_access->>'owner')::boolean,false) or case when p_scope='any' then jsonb_array_length(coalesce(u.admin_access->'scopes','[]'))>0 else coalesce(u.admin_access->'scopes','[]')?p_scope end))
$$;
revoke all on function godrop_private.admin_has_scope(uuid,text) from public,anon;
grant execute on function godrop_private.admin_has_scope(uuid,text) to authenticated,service_role;
create or replace function public.append_admin_audit(p_actor uuid,p_event text,p_entity text,p_details jsonb default '{}')
returns void language plpgsql security definer set search_path=public as $$
begin
 if not godrop_private.admin_has_scope(p_actor,'any') then raise exception 'admin_required'; end if;
 insert into admin_audit_log(actor_id,event,entity,details) values(p_actor,left(p_event,100),left(p_entity,100),p_details);
end $$;
revoke all on function public.append_admin_audit(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.append_admin_audit(uuid,text,text,jsonb) to service_role;

alter table public.driver_documents add column review_status text not null default 'pending' check(review_status in ('pending','approved','rejected')),
 add column reviewed_by uuid references public.users(id),add column reviewed_at timestamptz,add column review_reason text;
-- New metadata is never writable through a browser client.
revoke insert(review_status,reviewed_by,reviewed_at,review_reason),update(review_status,reviewed_by,reviewed_at,review_reason) on public.driver_documents from public,anon,authenticated;
create or replace function public.review_driver_document(p_actor uuid,p_id uuid,p_status text,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare d driver_documents%rowtype;
begin
 if not godrop_private.admin_has_scope(p_actor,'operations') then raise exception 'admin_required'; end if;
 if p_status not in ('approved','rejected') or (p_status='rejected' and length(trim(coalesce(p_reason,'')))<3) then raise exception 'review_reason_required'; end if;
 select * into d from driver_documents where id=p_id for update;
 if not found then raise exception 'document_missing'; end if;
 if p_status='approved' and d.expires_on is not null and d.expires_on<current_date then raise exception 'document_expired'; end if;
 perform set_config('app.admin_actor',p_actor::text,true);
 update driver_documents set review_status=p_status,reviewed_by=p_actor,reviewed_at=now(),review_reason=left(p_reason,500) where id=p_id;
 if p_status='rejected' then update driver_profiles set status='pending',is_online=false where id=d.driver_id;end if;
 perform append_admin_audit(p_actor,'document_'||p_status,p_id::text,jsonb_build_object('driver_id',d.driver_id,'reason',p_reason));
end $$;
revoke all on function public.review_driver_document(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_driver_document(uuid,uuid,text,text) to service_role;
create or replace function public.admin_assign_delivery(p_actor uuid,p_id uuid,p_driver uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype;
begin
 if not godrop_private.admin_has_scope(p_actor,'operations') then raise exception 'admin_required';end if;
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'assignment_reason_required';end if;
 select * into o from delivery_requests where id=p_id for update;
 if not found or o.status not in ('requested','accepted') then raise exception 'assignment_unavailable';end if;
 perform set_config('app.admin_actor',p_actor::text,true);
 update delivery_requests set driver_id=p_driver,status=case when p_driver is null then 'requested' else 'accepted' end where id=p_id;
 insert into delivery_status_logs(delivery_id,status,updated_by) values(p_id,case when p_driver is null then 'requested' else 'accepted' end,p_actor);
 perform append_admin_audit(p_actor,'driver_assignment',p_id::text,jsonb_build_object('before',o.driver_id,'after',p_driver,'reason',left(p_reason,500)));
end $$;
revoke all on function public.admin_assign_delivery(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_assign_delivery(uuid,uuid,uuid,text) to service_role;

-- Store exceptional cancellations for explicit operations/finance review.
alter table public.delivery_requests add column recovery_case jsonb,add column cancellation_policy jsonb;
revoke insert(recovery_case,cancellation_policy),update(recovery_case,cancellation_policy) on public.delivery_requests from public,anon,authenticated;
create or replace function public.admin_recovery_case(p_actor uuid,p_id uuid,p_action text,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype;
begin
 if not godrop_private.admin_has_scope(p_actor,'operations') then raise exception 'admin_required';end if;
 if p_action not in ('open','return_to_pickup','close') or length(trim(coalesce(p_reason,'')))<5 then raise exception 'recovery_reason_required';end if;
 select * into o from delivery_requests where id=p_id for update;
 if not found then raise exception 'order_missing';end if;
 update delivery_requests set recovery_case=coalesce(recovery_case,'{}')||jsonb_build_object('status',case when p_action='close' then 'closed' else 'open' end,'action',p_action,'reason',left(p_reason,1000),'actor',p_actor,'at',now()) where id=p_id;
 perform append_admin_audit(p_actor,'order_recovery_'||p_action,p_id::text,jsonb_build_object('reason',p_reason));
end $$;
revoke all on function public.admin_recovery_case(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_recovery_case(uuid,uuid,text,text) to service_role;

-- Accurate all-row finance aggregates; absent evidence remains unreconciled.
create or replace function public.admin_finance_snapshot(p_actor uuid,p_from timestamptz default null,p_to timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;goods_reserve numeric;
begin
 if not godrop_private.admin_has_scope(p_actor,'finance') then raise exception 'finance_permission_required';end if;
 with paid as (select p.* from payments p where p.status='paid' and coalesce(p.paid_at,p.created_at at time zone 'UTC')>=coalesce(p_from,'-infinity') and coalesce(p.paid_at,p.created_at at time zone 'UTC')<coalesce(p_to,'infinity')),
 refunds as (select coalesce(sum((r->>'amount')::numeric) filter(where r->>'state'='succeeded'),0) completed,coalesce(sum((r->>'amount')::numeric) filter(where r->>'state' in ('pending','requires_action')),0) pending from paid p cross join lateral jsonb_array_elements(coalesce(p.refund_jobs,'[]')) r),
 earned as (select e.amount,e.commission_amount from driver_earnings e where (e.created_at at time zone 'UTC')>=coalesce(p_from,'-infinity') and (e.created_at at time zone 'UTC')<coalesce(p_to,'infinity'))
 select jsonb_build_object(
 'customerPayments',(select coalesce(sum(amount),0) from paid),
 'shoppingFunds',(select coalesce(sum((booking_draft->>'max_spend_approved')::numeric),0) from paid),
 'processingCosts',(select coalesce(sum(processing_fee),0) from paid),
 'unknownProcessingCosts',(select count(*) from paid where payment_method='stripe' and processing_fee is null),
 'refunds',(select completed from refunds),'pendingRefunds',(select pending from refunds),
 'driverEarnings',(select coalesce(sum(amount),0) from earned),
 'recordedCommission',(select coalesce(sum(commission_amount),0) from earned),
 'bankPaid',(select coalesce(sum(amount),0) from payouts where status='paid' and processed_at>=coalesce(p_from,'-infinity') and processed_at<coalesce(p_to,'infinity')),
 'missingPaymentOrders',(select count(*) from delivery_requests d where d.status='delivered' and not exists(select 1 from payments p where p.delivery_id=d.id and p.status='paid')),
 'missingEarningsOrders',(select count(*) from delivery_requests d where d.status='delivered' and d.driver_id is not null and not exists(select 1 from driver_earnings e where e.delivery_id=d.id)),
 'orders',(select count(*) from delivery_requests d where (d.created_at at time zone 'UTC')>=coalesce(p_from,'-infinity') and (d.created_at at time zone 'UTC')<coalesce(p_to,'infinity')),
 'completed',(select count(*) from delivery_requests d where d.status='delivered' and (d.created_at at time zone 'UTC')>=coalesce(p_from,'-infinity') and (d.created_at at time zone 'UTC')<coalesce(p_to,'infinity')),
 'active',(select count(*) from delivery_requests where status in ('requested','accepted','collected','picked_up','in_transit')),
 'chart',(select coalesce(jsonb_agg(x order by x."day"),'[]') from (select to_char(coalesce(p.paid_at,p.created_at at time zone 'UTC') at time zone 'Europe/London','YYYY-MM-DD') as "day",sum(p.amount-coalesce((p.booking_draft->>'max_spend_approved')::numeric,0)) revenue from paid p where coalesce(p.paid_at,p.created_at at time zone 'UTC')>=now()-interval '7 days' group by 1) x)
 ) into result;
 select coalesce(sum(greatest(0,coalesce((p.booking_draft->>'max_spend_approved')::numeric,0)-least(coalesce((p.booking_draft->>'max_spend_approved')::numeric,0),coalesce((select sum((r->>'amount')::numeric) from jsonb_array_elements(coalesce(p.refund_jobs,'[]')) r where r->>'state'='succeeded' and r->>'key' in ('unused-shopping','cancel-order')),0)))),0) into goods_reserve from payments p where p.status='paid' and coalesce(p.paid_at,p.created_at at time zone 'UTC')>=coalesce(p_from,'-infinity') and coalesce(p.paid_at,p.created_at at time zone 'UTC')<coalesce(p_to,'infinity');
 result:=result||jsonb_build_object('servicePayments',(result->>'customerPayments')::numeric-(result->>'shoppingFunds')::numeric,
 'shoppingCommittedOrReserved',goods_reserve,
 'netContributionBeforeOtherCosts',(result->>'customerPayments')::numeric-(result->>'refunds')::numeric-(result->>'processingCosts')::numeric-(result->>'driverEarnings')::numeric-goods_reserve);
 return result;
end $$;
revoke all on function public.admin_finance_snapshot(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.admin_finance_snapshot(uuid,timestamptz,timestamptz) to service_role;

-- Individual document review metadata must survive replacement/re-upload.
create or replace function public.reset_document_review()
returns trigger language plpgsql set search_path=public as $$
begin
 if new.file_url is distinct from old.file_url or new.expires_on is distinct from old.expires_on or new.document_type is distinct from old.document_type then
  new.review_status:='pending';new.reviewed_by:=null;new.reviewed_at:=null;new.review_reason:=null;
 end if;return new;
end $$;
create trigger reset_document_review before update on public.driver_documents for each row execute function public.reset_document_review();

-- Immutable audit entries for changes made through existing workflows as well.
create or replace function public.audit_operational_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare actor uuid;entity_id text;before_data jsonb;after_data jsonb;
begin
 actor:=nullif(current_setting('app.admin_actor',true),'')::uuid;
 if actor is null and godrop_private.admin_has_scope(auth.uid(),'any') then actor:=auth.uid();end if;
 if tg_table_name='delivery_requests' then
  if new.status is not distinct from old.status and new.driver_id is not distinct from old.driver_id and new.recovery_case is not distinct from old.recovery_case then return new;end if;
  before_data:=jsonb_build_object('status',old.status,'driver',old.driver_id);after_data:=jsonb_build_object('status',new.status,'driver',new.driver_id);
 elsif tg_table_name='driver_profiles' then
  if new.status is not distinct from old.status then return new;end if;
  before_data:=jsonb_build_object('status',old.status);after_data:=jsonb_build_object('status',new.status);
 elsif tg_table_name='surge_pricing_settings' then
  if new.booking_pricing is not distinct from old.booking_pricing and new.operational_settings is not distinct from old.operational_settings and new.master_enabled is not distinct from old.master_enabled and new.notification_settings is not distinct from old.notification_settings and new.platform_settings is not distinct from old.platform_settings and (new.demand_enabled,new.demand_threshold_ratio,new.demand_multiplier,new.traffic_enabled,new.traffic_threshold_ratio,new.traffic_multiplier,new.max_total_multiplier,new.automatic_payouts) is not distinct from (old.demand_enabled,old.demand_threshold_ratio,old.demand_multiplier,old.traffic_enabled,old.traffic_threshold_ratio,old.traffic_multiplier,old.max_total_multiplier,old.automatic_payouts) then return new;end if;
  before_data:=to_jsonb(old)-array['booking_pricing_history','operations_history','geocode_rate_buckets','payout_worker_token','payout_worker_until','integration_health'];after_data:=to_jsonb(new)-array['booking_pricing_history','operations_history','geocode_rate_buckets','payout_worker_token','payout_worker_until','integration_health'];
 else
  before_data:=to_jsonb(old)-array['file_url','order_messages','replies'];after_data:=to_jsonb(new)-array['file_url','order_messages','replies'];
 end if;
 entity_id:=coalesce(to_jsonb(new)->>'id','settings');
 insert into admin_audit_log(actor_id,event,entity,details) values(actor,tg_table_name||'_changed',entity_id,jsonb_build_object('before',before_data,'after',after_data,'source',case when actor is null then 'system' else 'admin' end));
 return new;
end $$;
revoke all on function public.audit_operational_change() from public,anon,authenticated;
create trigger audit_delivery after update on public.delivery_requests for each row execute function public.audit_operational_change();
create trigger audit_driver after update on public.driver_profiles for each row execute function public.audit_operational_change();
create trigger audit_settings after update on public.surge_pricing_settings for each row execute function public.audit_operational_change();
create trigger audit_disputes after update on public.disputes for each row execute function public.audit_operational_change();
create trigger audit_ratings after update on public.ratings for each row execute function public.audit_operational_change();
create trigger audit_payouts after update on public.payouts for each row execute function public.audit_operational_change();

create or replace function public.save_operational_settings(p_actor uuid,p_config jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not godrop_private.admin_has_scope(p_actor,'settings') then raise exception 'settings_permission_required';end if;
 perform set_config('app.admin_actor',p_actor::text,true);
 update surge_pricing_settings set operational_settings=p_config,updated_at=now() where id=true;
 if not found then raise exception 'settings_missing';end if;
end $$;
revoke all on function public.save_operational_settings(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_operational_settings(uuid,jsonb) to service_role;

-- Bookings already paid remain fulfilable even if an administrator pauses intake.
-- New checkout requests and wallet bookings are gated in their server actions.
create or replace function public.snapshot_driver_earnings()
returns trigger language plpgsql security definer set search_path=public as $$
declare config jsonb;ops jsonb; floor_quote numeric;
begin
 select booking_pricing,operational_settings into config,ops from surge_pricing_settings where id=true;
 floor_quote:=coalesce(new.distance_miles,0)*coalesce((ops->>'driverPerMile')::numeric,0)+coalesce(new.duration_min,0)*coalesce((ops->>'driverPerMinute')::numeric,0)+case when new.package_size='bulky' then coalesce((ops->>'vanDriverExtra')::numeric,0) else 0 end;
 new.driver_earning_quote:=round(greatest(new.price*(1-coalesce((config->>'commissionPercent')::numeric,20)/100),coalesce((config->>'minimumDriverEarnings')::numeric,4.49),floor_quote),2);
 new.cancellation_policy:=jsonb_build_object('before',coalesce(ops->>'cancellationBeforePickup','full_refund'),'after',coalesce(ops->>'cancellationAfterPickup','review'));
 return new;
end $$;
revoke all on function public.snapshot_driver_earnings() from public,anon,authenticated;

create or replace function public.guard_account_activity()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_table_name='payments' then
  if not exists(select 1 from users where id=new.customer_id and account_status='active') then raise exception 'account_unavailable';end if;
 elsif new.driver_id is distinct from old.driver_id and new.driver_id is not null then
  if not exists(select 1 from users where id=new.driver_id and account_status='active') then raise exception 'driver_account_unavailable';end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_account_activity() from public,anon,authenticated;
create trigger guard_payment_account before insert on public.payments for each row execute function public.guard_account_activity();
create trigger guard_assignment_account before update of driver_id on public.delivery_requests for each row execute function public.guard_account_activity();

create or replace function public.set_admin_staff_access(p_actor uuid,p_target uuid,p_owner boolean,p_scopes jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from users where id=p_actor and role='admin' and account_status='active' and admin_access->>'owner'='true') then raise exception 'owner_required';end if;
 if p_target=p_actor then raise exception 'self_access_change_blocked';end if;
 if p_owner is null or jsonb_typeof(p_scopes) is distinct from 'array' or exists(select 1 from jsonb_array_elements_text(p_scopes) s where s not in ('operations','finance','support','settings','marketing')) then raise exception 'invalid_scope';end if;
 perform 1 from driver_profiles where id=p_target for update;
 perform 1 from users where id=p_target and account_status='active' for update;
 if not found then raise exception 'account_missing';end if;
 if exists(select 1 from delivery_requests where (driver_id=p_target or customer_id=p_target) and status in ('requested','accepted','collected','picked_up','in_transit')) then raise exception 'resolve_active_orders_first';end if;
 update users set role='admin',admin_access=jsonb_build_object('owner',p_owner,'scopes',p_scopes) where id=p_target;
 update driver_profiles set is_online=false where id=p_target;
 perform append_admin_audit(p_actor,'staff_access',p_target::text,jsonb_build_object('owner',p_owner,'scopes',p_scopes));
end $$;
revoke all on function public.set_admin_staff_access(uuid,uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.set_admin_staff_access(uuid,uuid,boolean,jsonb) to service_role;
create or replace function public.admin_account_state(p_actor uuid,p_target uuid,p_state text,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not godrop_private.admin_has_scope(p_actor,'support') then raise exception 'support_permission_required';end if;
 if p_state not in ('active','suspended','archived') or length(trim(coalesce(p_reason,'')))<5 or p_actor=p_target then raise exception 'invalid_account_change';end if;
 if exists(select 1 from users where id=p_target and role='admin') then raise exception 'admin_account_protected';end if;
 perform 1 from users where id=p_target for update;
 if not found then raise exception 'account_missing';end if;
 if p_state<>'active' and exists(select 1 from delivery_requests where (customer_id=p_target or driver_id=p_target) and status in ('requested','accepted','collected','picked_up','in_transit')) then raise exception 'resolve_active_orders_first';end if;
 update users set account_status=p_state where id=p_target;
 if p_state<>'active' then update driver_profiles set is_online=false where id=p_target;end if;
 perform append_admin_audit(p_actor,'account_'||p_state,p_target::text,jsonb_build_object('reason',left(p_reason,1000)));
end $$;
revoke all on function public.admin_account_state(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_account_state(uuid,uuid,text,text) to service_role;

create or replace function public.admin_customer_hub(p_actor uuid,p_customer uuid,p_page integer default 1)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;off integer:=(greatest(1,least(p_page,100000))-1)*20;finance boolean;
begin
 if not(godrop_private.admin_has_scope(p_actor,'support') or godrop_private.admin_has_scope(p_actor,'operations')) then raise exception 'permission_required';end if;
 finance:=godrop_private.admin_has_scope(p_actor,'finance');
 select jsonb_build_object(
 'customer',(select jsonb_build_object('id',u.id,'name',u.full_name,'phone',u.phone,'email',u.email,'account_status',u.account_status,'joined',u.created_at) from users u join admin_customer_accounts c on c.id=u.id where u.id=p_customer),
 'orders',(select coalesce(jsonb_agg(x),'[]') from (select id,tracking_number,status,price,service_type,receipt_url,shopping_started_at,delivered_at,created_at from delivery_requests where customer_id=p_customer order by created_at desc,id offset off limit 20) x),
 'orderCount',(select count(*) from delivery_requests where customer_id=p_customer),
 'support',(select coalesce(jsonb_agg(x),'[]') from (select id,subject,status,created_at from support_tickets where user_id=p_customer order by created_at desc,id offset off limit 20) x),
 'addresses',(select coalesce(jsonb_agg(x),'[]') from (select id,address,created_at from addresses where user_id=p_customer order by created_at desc,id offset off limit 20) x),
 'wallet',case when finance then (select coalesce(jsonb_agg(x),'[]') from (select id,type,amount,description,delivery_id,created_at from wallet_transactions where user_id=p_customer order by created_at desc,id offset off limit 20) x) else '[]'::jsonb end,
 'balance',case when finance then (select balance from wallet_balances where user_id=p_customer) else null end,
 'payments',case when finance then (select coalesce(jsonb_agg(x),'[]') from (select id,delivery_id,amount,status,payment_method,refund_jobs,created_at from payments where customer_id=p_customer or delivery_id in(select id from delivery_requests where customer_id=p_customer) order by created_at desc,id offset off limit 20) x) else '[]'::jsonb end,
 'paid',case when finance then (select coalesce(sum(p.amount-(select coalesce(sum((r->>'amount')::numeric),0) from jsonb_array_elements(coalesce(p.refund_jobs,'[]')) r where r->>'state'='succeeded')),0) from payments p where p.status='paid' and (p.customer_id=p_customer or p.delivery_id in(select id from delivery_requests where customer_id=p_customer))) else null end,
 'finance',finance,
 'hasMore',exists(select 1 from delivery_requests where customer_id=p_customer offset off+20) or exists(select 1 from support_tickets where user_id=p_customer offset off+20) or exists(select 1 from addresses where user_id=p_customer offset off+20) or (finance and (exists(select 1 from wallet_transactions where user_id=p_customer offset off+20) or exists(select 1 from payments where customer_id=p_customer or delivery_id in(select id from delivery_requests where customer_id=p_customer) offset off+20)))
 ) into result;return result;
end $$;
revoke all on function public.admin_customer_hub(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.admin_customer_hub(uuid,uuid,integer) to service_role;

create view public.admin_customer_directory with(security_invoker=true) as
 select c.id,c.full_name,c.phone,c.email,c.created_at,u.account_status,
 (select count(*) from delivery_requests d where d.customer_id=c.id) delivery_count,
 (select max(created_at) from delivery_requests d where d.customer_id=c.id) last_order_at,
 coalesce((select sum(p.amount) from payments p where p.status='paid' and (p.customer_id=c.id or p.delivery_id in(select id from delivery_requests d where d.customer_id=c.id))),0) total_spend
 from admin_customer_accounts c join users u on u.id=c.id;
revoke all on public.admin_customer_directory from public,anon,authenticated;
grant select on public.admin_customer_directory to service_role;

create or replace function public.admin_record_list(p_actor uuid,p_kind text,p_page integer default 1,p_search text default '',p_status text default '',p_from timestamptz default null,p_to timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare source text;scope text;search_columns text;where_clause text:='true';rows jsonb;total bigint;off integer:=(greatest(1,least(p_page,100000))-1)*50;
begin
 case p_kind
 when 'orders' then source:='delivery_requests';scope:='operations';search_columns:='coalesce(tracking_number,'''')||'' ''||coalesce(pickup_address,'''')||'' ''||coalesce(delivery_address,'''')';
 when 'customers' then source:='admin_customer_directory';scope:='operations';search_columns:='coalesce(full_name,'''')||'' ''||coalesce(email,'''')||'' ''||coalesce(phone,'''')';
 when 'drivers' then source:='admin_driver_accounts';scope:='operations';search_columns:='coalesce(full_name,'''')||'' ''||coalesce(email,'''')||'' ''||coalesce(phone,'''')';
 when 'disputes' then source:='disputes';scope:='support';search_columns:='coalesce(issue,'''')';
 when 'support' then source:='support_tickets';scope:='support';search_columns:='coalesce(subject,'''')||'' ''||coalesce(message,'''')';
 when 'reviews' then source:='ratings';scope:='support';search_columns:='coalesce(comment,'''')';
 when 'audit' then source:='admin_audit_log';scope:='settings';search_columns:='event||'' ''||entity';
 when 'payments' then source:='payments';scope:='finance';search_columns:='coalesce(stripe_payment_intent,'''')';
 else raise exception 'unsupported_record_type';end case;
 if not (godrop_private.admin_has_scope(p_actor,scope) or p_kind='customers' and godrop_private.admin_has_scope(p_actor,'support')) then raise exception 'permission_required';end if;
 if length(coalesce(p_search,''))>100 then raise exception 'search_too_long';end if;
 if coalesce(p_search,'')<>'' then where_clause:=where_clause||format(' and (id::text=%L or (%s) ilike %L)',p_search,search_columns,'%'||replace(replace(replace(p_search,'\','\\'),'%','\%'),'_','\_')||'%');end if;
 if coalesce(p_status,'')<>'' and p_kind in ('orders','support','reviews','payments','disputes') then where_clause:=where_clause||format(' and status=%L',p_status);end if;
 if p_kind='customers' and p_status='recent' then where_clause:=where_clause||' and last_order_at>=now() at time zone ''UTC''-interval ''30 days''';end if;
 if p_kind='customers' and p_status='inactive' then where_clause:=where_clause||' and (last_order_at is null or last_order_at<now() at time zone ''UTC''-interval ''30 days'')';end if;
 if p_from is not null then where_clause:=where_clause||case when p_kind='audit' then format(' and created_at>=%L',p_from) else format(' and created_at>=%L',p_from at time zone 'UTC') end;end if;
 if p_to is not null then where_clause:=where_clause||case when p_kind='audit' then format(' and created_at<%L',p_to) else format(' and created_at<%L',p_to at time zone 'UTC') end;end if;
 execute format('select count(*) from %I where %s',source,where_clause) into total;
 execute format('select coalesce(jsonb_agg(x),''[]''::jsonb) from (select * from %I where %s order by created_at desc,id offset %s limit 50) x',source,where_clause,off) into rows;
 if p_kind='customers' and not godrop_private.admin_has_scope(p_actor,'finance') then select coalesce(jsonb_agg(r-'total_spend'),'[]') into rows from jsonb_array_elements(rows) r;end if;
 -- Avoid returning user administrative metadata through a general directory.
 if p_kind='drivers' then select coalesce(jsonb_agg(r-array['admin_access','order_photo_leases']),'[]') into rows from jsonb_array_elements(rows) r;end if;
 return jsonb_build_object('rows',rows,'count',total,'page',off/50+1);
end $$;
revoke all on function public.admin_record_list(uuid,text,integer,text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.admin_record_list(uuid,text,integer,text,text,timestamptz,timestamptz) to service_role;

create or replace function public.marketing_customer_activity(p_ids uuid[])
returns jsonb language sql security definer set search_path=public as $$
 select coalesce(jsonb_object_agg(u.id,coalesce((select max(d.created_at) from delivery_requests d where d.customer_id=u.id),u.created_at)),'{}') from users u where u.id=any(p_ids)
$$;
revoke all on function public.marketing_customer_activity(uuid[]) from public,anon,authenticated;
grant execute on function public.marketing_customer_activity(uuid[]) to service_role;

create or replace function public.record_integration_health(p_key text,p_ok boolean,p_detail text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_key !~ '^[a-z_-]{1,50}$' then raise exception 'invalid_health_key';end if;
 update surge_pricing_settings set integration_health=jsonb_set(integration_health,array[p_key],coalesce(integration_health->p_key,'{}')||jsonb_build_object('last_checked',now(),'ok',p_ok,'detail',left(p_detail,200))||case when p_ok then jsonb_build_object('last_success',now()) else jsonb_build_object('last_failure',now()) end) where id=true;
end $$;
revoke all on function public.record_integration_health(text,boolean,text) from public,anon,authenticated;
grant execute on function public.record_integration_health(text,boolean,text) to service_role;

-- Separate waiting-payment rows keep the original one-payment-per-order index.
alter table public.payments add column purpose text not null default 'booking' check(purpose in ('booking','collection_wait')),
 add column related_delivery_id uuid references public.delivery_requests(id);
alter table public.driver_earnings add column source_payment_id uuid unique references public.payments(id);
revoke insert(purpose,related_delivery_id),update(purpose,related_delivery_id) on public.payments from public,anon,authenticated;
revoke insert(source_payment_id),update(source_payment_id) on public.driver_earnings from public,anon,authenticated;
create index payments_related_delivery_idx on public.payments(related_delivery_id) where related_delivery_id is not null;
create or replace function public.reserve_waiting_checkout(p_actor uuid,p_id uuid,p_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype;p payments%rowtype;config jsonb;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found or o.customer_id<>p_actor or o.service_type<>'delivery' then raise exception 'not_allowed';end if;
 if o.collection_wait->>'payment_id' is not null then select * into p from payments where id=(o.collection_wait->>'payment_id')::uuid;return to_jsonb(p);end if;
 if o.status<>'accepted' or o.collection_wait->>'status'<>'approved_for_review' or coalesce((o.collection_wait->>'amount')::numeric,0)<=0 then raise exception 'approved_wait_required';end if;
 select booking_pricing into config from surge_pricing_settings where id=true;
 insert into payments(customer_id,request_key,related_delivery_id,purpose,amount,status,payment_method,booking_draft) values(p_actor,p_key,p_id,'collection_wait',(o.collection_wait->>'amount')::numeric,'pending','stripe',jsonb_build_object('type','collection_wait','driver_id',o.driver_id,'commission_percent',coalesce((config->>'commissionPercent')::numeric,20),'wait',o.collection_wait)) returning * into p;
 update delivery_requests set collection_wait=collection_wait||jsonb_build_object('payment_id',p.id) where id=p_id;
 return to_jsonb(p);
end $$;
revoke all on function public.reserve_waiting_checkout(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_waiting_checkout(uuid,uuid,uuid) to service_role;
create or replace function public.accrue_waiting_earnings(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype;p payments%rowtype;amount numeric;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found then return;end if;
 for p in select * from payments where related_delivery_id=p_id and purpose='collection_wait' and status='paid' for update loop
  if o.status='cancelled' then
   if not exists(select 1 from jsonb_array_elements(p.refund_jobs) j where j->>'key'='cancel-wait') then update payments set refund_jobs=refund_jobs||jsonb_build_array(jsonb_build_object('key','cancel-wait','amount',p.amount,'state','pending')) where id=p.id;end if;
  elsif o.status='delivered' and o.driver_id is not null then
   amount:=round(p.amount*(1-coalesce((p.booking_draft->>'commission_percent')::numeric,20)/100),2);
   insert into driver_earnings(driver_id,delivery_id,source_payment_id,amount,commission_amount,status) values(o.driver_id,null,p.id,amount,p.amount-amount,'pending') on conflict(source_payment_id) do nothing;
  end if;
 end loop;
end $$;
revoke all on function public.accrue_waiting_earnings(uuid) from public,anon,authenticated;
grant execute on function public.accrue_waiting_earnings(uuid) to service_role;
create or replace function public.finalize_waiting_checkout(p_payment uuid,p_session text,p_intent text,p_amount numeric)
returns uuid language plpgsql security definer set search_path=public as $$
declare p payments%rowtype;o delivery_requests%rowtype;
begin
 -- Lock the order before its payment, matching cancellation and accrual order.
 select d.* into o from delivery_requests d join payments x on x.related_delivery_id=d.id where x.id=p_payment for update of d;
 select * into p from payments where id=p_payment for update;
 if not found or p.purpose<>'collection_wait' or p.amount is distinct from p_amount or p.stripe_session_id is distinct from p_session or p_intent is null then raise exception 'waiting_payment_mismatch';end if;
 if p.status not in ('pending','paid') then raise exception 'invalid_payment_state';end if;
 if p.status='paid' and p.stripe_payment_intent is distinct from p_intent then raise exception 'intent_mismatch';end if;
 update payments set status='paid',stripe_payment_intent=p_intent,paid_at=coalesce(paid_at,now()) where id=p.id;
 update delivery_requests set collection_wait=collection_wait||jsonb_build_object('status','paid','paid_at',now()) where id=o.id and collection_wait->>'payment_id'=p.id::text;
 perform accrue_waiting_earnings(o.id);
 return o.id;
end $$;
revoke all on function public.finalize_waiting_checkout(uuid,text,text,numeric) from public,anon,authenticated;
grant execute on function public.finalize_waiting_checkout(uuid,text,text,numeric) to service_role;
create or replace function public.settle_waiting_after_order()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status in ('delivered','cancelled') and new.status is distinct from old.status then perform accrue_waiting_earnings(new.id);end if;return new;
end $$;
revoke all on function public.settle_waiting_after_order() from public,anon,authenticated;
create trigger settle_waiting_after_order after update of status on public.delivery_requests for each row execute function public.settle_waiting_after_order();

-- Apply the same staff scopes and MFA requirement to direct Data API access.
create or replace function godrop_private.admin_has_scope(p_actor uuid,p_scope text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from users u where u.id=p_actor and u.role='admin' and u.account_status='active' and
 (coalesce((u.admin_access->>'owner')::boolean,false) or case when p_scope='any' then jsonb_array_length(coalesce(u.admin_access->'scopes','[]'))>0 else coalesce(u.admin_access->'scopes','[]')?p_scope end))
 and (auth.uid() is null or not coalesce((select (operational_settings->>'requireAdminMfa')::boolean from surge_pricing_settings where id=true),false) or coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal','aal1')='aal2')
$$;
do $$ declare p record;scope text;predicate text;statement text;
begin
 for p in select * from pg_policies where schemaname='public' and policyname ilike '%admin%' loop
  scope:=case when p.tablename in ('payments','payouts','driver_earnings') then 'finance' when p.tablename in ('support_tickets','disputes','ratings','chat_messages','chat_sessions') then 'support' when p.tablename in ('marketing_campaign_recipients','marketing_campaigns','reengagement_sends','reengagement_settings') then 'marketing' when p.tablename in ('automatic_discounts','busy_period_rules','promo_codes','promo_code_redemptions') then 'settings' else 'operations' end;
  predicate:=format('godrop_private.admin_has_scope((select auth.uid()),%L)',scope);
  execute format('drop policy %I on public.%I',p.policyname,p.tablename);
  statement:=format('create policy %I on public.%I for %s to authenticated',p.policyname,p.tablename,p.cmd);
  if p.cmd in ('ALL','SELECT','UPDATE','DELETE') then statement:=statement||' using ('||predicate||')';end if;
  if p.cmd in ('ALL','INSERT','UPDATE') then statement:=statement||' with check ('||predicate||')';end if;
  execute statement;
 end loop;
end $$;
-- Restore privilege surface only for profile data; role/admin flags remain protected.
-- Existing customers/drivers already have their signup rows created server-side.
CREATE OR REPLACE FUNCTION public.pending_card_refund_orders()
 RETURNS TABLE(delivery_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select coalesce(p.delivery_id,p.related_delivery_id) as delivery_id from payments p where p.payment_method='stripe' and (p.delivery_id is not null or p.related_delivery_id is not null) and exists(select 1 from jsonb_array_elements(p.refund_jobs) r where r->>'state' in ('pending','requires_action')) group by coalesce(p.delivery_id,p.related_delivery_id) order by min(p.refund_checked_at) asc nulls first,min(p.created_at) asc limit 20;
$function$;
CREATE OR REPLACE FUNCTION public.admin_attention_queue(p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare result jsonb;
begin
 if not (godrop_private.admin_has_scope(p_actor,'operations') or godrop_private.admin_has_scope(p_actor,'finance') or godrop_private.admin_has_scope(p_actor,'support')) then raise exception 'admin_required'; end if;
 select coalesce(jsonb_agg(x),'[]') into result from (
 select id,reason,at,kind from (
 select d.id,'Shop problem reported'::text reason,d.created_at at,'order'::text kind from delivery_requests d where d.status not in ('cancelled','delivered') and d.shopping_problem is not null
 union all select s.delivery_id,'Customer approval pending',s.created_at,'order' from shopping_substitutions s join delivery_requests d on d.id=s.delivery_id where s.customer_approved is null and d.status not in ('cancelled','delivered')
 union all select p.delivery_id,'Card refund needs attention',p.created_at,'order' from payments p where p.delivery_id is not null and exists(select 1 from jsonb_array_elements(p.refund_jobs) r where r->>'state' in ('failed','requires_action'))

 union all select d.id,'Driver location missing or over 45 seconds old',d.created_at,'order' from delivery_requests d left join driver_locations l on l.driver_id=d.driver_id and l.delivery_id=d.id where d.status in ('accepted','collected','picked_up','in_transit') and (l.updated_at is null or l.updated_at<now()-interval '45 seconds')
 union all select d.id,'Shopping receipt missing',d.created_at,'order' from delivery_requests d where d.service_type='buy_for_me' and d.bfm_stage in ('purchase_completed','heading_to_customer','delivered') and d.receipt_url is null and d.status<>'cancelled'
 union all select p.id,'Bank payout needs reconciliation',p.created_at,'payout' from payouts p where p.provider->>'error' is not null or p.provider->>'state' in ('failed','canceled') or (p.provider is null and p.admin_note='historical_payouts_require_reconciliation')
 union all select coalesce(p.delivery_id,p.related_delivery_id,p.id),'Card payment failed',p.created_at,'payment' from payments p where p.status='failed'

 union all select d.id,'Shopping order needs a funded company purchase card',d.created_at,'order' from delivery_requests d where d.service_type='buy_for_me' and d.status in ('requested','accepted','collected') and d.company_card_verified_at is null and exists(select 1 from payments p where p.delivery_id=d.id and p.status='paid')
 union all select d.id,'Waiting request awaiting customer approval or payment',d.created_at,'order' from delivery_requests d where d.collection_wait->>'status' in ('awaiting_customer','approved_for_review') and d.status not in ('cancelled','delivered')
 union all select d.id,'Completed order has no confirmed payment — reconcile',d.created_at,'order' from delivery_requests d where d.status='delivered' and not exists(select 1 from payments p where p.delivery_id=d.id and p.status='paid')
 union all select d.id,'Completed order has no earnings record — reconcile',d.created_at,'order' from delivery_requests d where d.status='delivered' and d.driver_id is not null and not exists(select 1 from driver_earnings e where e.delivery_id=d.id)
 union all select p.id,'Checkout has remained pending for over 30 minutes',p.created_at,'payment' from payments p where p.status='pending' and p.created_at<now() at time zone 'UTC'-interval '30 minutes'
 union all select d.id,'Open recovery case',d.created_at,'order' from delivery_requests d where d.recovery_case->>'status'='open'
 ) q order by at,id limit 100) x;
 return result;
end $function$;
CREATE OR REPLACE FUNCTION public.save_booking_pricing(p_actor uuid, p_config jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare previous jsonb;
begin
 perform set_config('app.admin_actor',p_actor::text,true);
 if not exists(select 1 from users where id=p_actor and role='admin') then raise exception 'not_authorized'; end if;
 select booking_pricing into previous from surge_pricing_settings where id=true for update;
 if not found then raise exception 'settings_missing'; end if;
 update surge_pricing_settings set booking_pricing=p_config,updated_at=now(),booking_pricing_history=booking_pricing_history||jsonb_build_array(jsonb_build_object('at',now(),'actor',p_actor,'before',previous,'after',p_config)) where id=true;
end $function$;
CREATE OR REPLACE FUNCTION public.approve_driver_verification(p_driver uuid, p_actor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 perform set_config('app.admin_actor',p_actor::text,true);
 if exists(select 1 from driver_documents where driver_id=p_driver and review_status<>'approved') then raise exception 'review_documents_first';end if;
 if not godrop_private.admin_has_scope(p_actor,'operations') then raise exception 'admin_required'; end if;
 perform 1 from driver_profiles where id=p_driver and verification_submitted_at is not null for update;
 if not found or not driver_compliance_ready(p_driver) then raise exception 'valid_submitted_documents_required'; end if;
 update driver_profiles set status='approved' where id=p_driver;
end $function$;
revoke all on function public.pending_card_refund_orders(),public.admin_attention_queue(uuid),public.save_booking_pricing(uuid,jsonb),public.approve_driver_verification(uuid,uuid) from public,anon,authenticated;
grant execute on function public.pending_card_refund_orders(),public.admin_attention_queue(uuid),public.save_booking_pricing(uuid,jsonb),public.approve_driver_verification(uuid,uuid) to service_role;


create table public.integration_dispatches(id uuid primary key default gen_random_uuid(),channel text not null check(channel in ('push','email')),user_id uuid references public.users(id),payload jsonb not null,dispatch_key text not null unique,state text not null default 'failed' check(state in ('failed','sending','sent','skipped')),attempts integer not null default 1,lease_until timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.integration_dispatches enable row level security;
revoke all on public.integration_dispatches from public,anon,authenticated;
grant select,insert,update on public.integration_dispatches to service_role;
create index integration_dispatch_pending on public.integration_dispatches(state,created_at);
create or replace function public.claim_dispatch_retry(p_actor uuid,p_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d integration_dispatches%rowtype;
begin
 select * into d from integration_dispatches where id=p_id for update;
 if not found or not godrop_private.admin_has_scope(p_actor,case when d.channel='email' then 'marketing' else 'operations' end) then raise exception 'permission_required';end if;
 if d.state in ('sent','skipped') or (d.state='sending' and d.lease_until>now()) then raise exception 'already_sent_or_busy';end if;
 if d.created_at<now()-interval '20 hours' then raise exception 'retry_window_expired';end if;
 update integration_dispatches set state='sending',lease_until=now()+interval '3 minutes',attempts=attempts+1,updated_at=now() where id=p_id;
 perform append_admin_audit(p_actor,'notification_retry',p_id::text,jsonb_build_object('channel',d.channel));
 return to_jsonb(d);
end $$;
revoke all on function public.claim_dispatch_retry(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_dispatch_retry(uuid,uuid) to service_role;

-- Column revokes cannot override an existing table grant: guard new admin fields.
create or replace function public.guard_admin_record_metadata()
returns trigger language plpgsql set search_path=public as $$
begin
 if current_user in ('postgres','service_role','supabase_admin') then return new;end if;
 if tg_table_name='delivery_requests' then
  if tg_op='INSERT' then if new.recovery_case is not null or new.cancellation_policy is not null or new.collection_wait is not null then raise exception 'admin_metadata_protected';end if;
  elsif new.recovery_case is distinct from old.recovery_case or new.cancellation_policy is distinct from old.cancellation_policy or new.collection_wait is distinct from old.collection_wait or new.driver_earning_quote is distinct from old.driver_earning_quote then raise exception 'admin_metadata_protected';end if;
 elsif tg_table_name='payments' then
  if new.purpose<>'booking' or new.related_delivery_id is not null then raise exception 'payment_metadata_protected';end if;
 end if;return new;
end $$;
create trigger guard_admin_metadata before insert or update on public.delivery_requests for each row execute function public.guard_admin_record_metadata();
create trigger guard_admin_metadata before insert or update on public.payments for each row execute function public.guard_admin_record_metadata();
create index if not exists admin_payments_customer_history on public.payments(customer_id,created_at desc,id);
create index if not exists admin_deliveries_history on public.delivery_requests(created_at desc,id);
create index if not exists admin_support_history on public.support_tickets(created_at desc,id);

create or replace function public.admin_driver_totals(p_actor uuid,p_driver uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not godrop_private.admin_has_scope(p_actor,'operations') then raise exception 'operations_permission_required';end if;
 return jsonb_build_object('earned',(select coalesce(sum(amount),0) from driver_earnings where driver_id=p_driver),'completed',(select count(*) from delivery_requests where driver_id=p_driver and status='delivered'),'paid',(select coalesce(sum(amount),0) from payouts where driver_id=p_driver and status='paid'));
end $$;
revoke all on function public.admin_driver_totals(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_driver_totals(uuid,uuid) to service_role;
CREATE OR REPLACE FUNCTION public.admin_wallet_refund(p_order uuid, p_actor uuid, p_amount numeric, p_key uuid, p_cancel boolean DEFAULT false)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o delivery_requests%rowtype; paid numeric; refunded numeric; previous wallet_transactions%rowtype;
begin
 perform set_config('app.admin_actor',p_actor::text,true);
 if not exists(select 1 from users where id=p_actor and role='admin') then raise exception 'admin_required'; end if;
 if p_key is null then raise exception 'request_key_required'; end if;
 select * into o from delivery_requests where id=p_order for update;
 if not found or o.customer_id is null then raise exception 'order_not_found'; end if;
 if o.payment_method='stripe' then raise exception 'use_original_card_refund'; end if;
 select * into previous from wallet_transactions where refund_request_key=p_key;
 if found then
 if previous.delivery_id<>p_order or previous.amount is distinct from p_amount then raise exception 'retry_mismatch'; end if;
 return previous.amount;
 end if;
 if p_cancel and (o.status not in ('requested','accepted') or o.bfm_stage in ('shopping','purchase_completed','heading_to_customer')) then raise exception 'contact_support_for_purchase_reconciliation'; end if;
 select coalesce(sum(amount),0) into paid from wallet_transactions where delivery_id=p_order and user_id=o.customer_id and type='deduction';
 select coalesce(sum(amount),0) into refunded from wallet_transactions where delivery_id=p_order and user_id=o.customer_id and type='cashback';
 if p_cancel then p_amount:=greatest(0,paid-refunded-coalesce(case when o.service_type='buy_for_me' then o.max_spend_approved else 0 end,0)); end if;
 if p_amount::text in ('NaN','Infinity','-Infinity') or p_amount is null or p_amount<0 or p_amount>greatest(0,paid-refunded-case when o.service_type='buy_for_me' and o.shopping_hold_settled_at is null then coalesce(o.max_spend_approved,0) else 0 end) then raise exception 'invalid_refund_amount'; end if;
 if p_amount>0 then
 insert into wallet_transactions(user_id,type,amount,description,delivery_id,refund_request_key) values(o.customer_id,'cashback',p_amount,'Admin refund by '||p_actor::text,p_order,p_key);
 insert into wallet_balances(user_id,balance,updated_at) values(o.customer_id,p_amount,now()) on conflict(user_id) do update set balance=wallet_balances.balance+excluded.balance,updated_at=now();
 end if;
 if p_cancel then update delivery_requests set status='cancelled',cancelled_by='admin' where id=p_order; end if;
 return p_amount;
end $function$;
CREATE OR REPLACE FUNCTION public.cancel_card_order(p_id uuid, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o delivery_requests%rowtype; actor_role text; p payments%rowtype;
begin
 perform set_config('app.admin_actor',p_actor::text,true);
 select * into o from delivery_requests where id=p_id for update;
 select role into actor_role from users where id=p_actor;
 if o.id is null or (o.customer_id is distinct from p_actor and o.driver_id is distinct from p_actor and actor_role is distinct from 'admin') then raise exception 'not_authorized'; end if;
 if o.payment_method<>'stripe' then raise exception 'not_card_order'; end if;
 if o.status='cancelled' then return jsonb_build_object('refund_queued',true); end if;
 if o.status not in ('requested','accepted') or o.bfm_stage in ('shopping','purchase_completed','heading_to_customer') then raise exception 'contact_support_after_collection'; end if;
 select * into p from payments where delivery_id=o.id and payment_method='stripe' and status='paid' for update;
 perform queue_order_refund(o.id,'cancel-order',p.amount);
 update delivery_requests set status='cancelled',cancelled_by=case when actor_role='admin' then 'admin' when o.customer_id=p_actor then 'customer' else 'driver' end,shopping_hold_settled_at=case when service_type='buy_for_me' then now() else shopping_hold_settled_at end where id=o.id;
 return jsonb_build_object('refund_queued',true,'amount',p.amount);
end $function$;
CREATE OR REPLACE FUNCTION public.cancel_delivery_order(p_delivery_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  v_customer_id uuid := auth.uid();
  v_delivery record;
  v_free_cancel boolean;
  v_deduction_amount numeric;
  v_refund_amount numeric := 0;
  v_cancellation_fee numeric := 0;
  v_distance_miles numeric := 0;
  v_label text;
BEGIN
  if v_customer_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_delivery
  from delivery_requests
  where id = p_delivery_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if v_delivery.customer_id <> v_customer_id then
    raise exception 'not_your_order';
  end if;
  if v_delivery.cancellation_policy->>'before'='review' then raise exception 'cancellation_review_required';end if;
  if v_delivery.payment_method='stripe' then raise exception 'use_card_cancellation';end if;
  if v_delivery.status not in ('requested','accepted') or v_delivery.bfm_stage in ('shopping','purchase_completed','heading_to_customer') then raise exception 'cannot_cancel_after_collection';end if;
  if v_delivery.status in ('delivered', 'cancelled') then
    raise exception 'cannot_cancel';
  end if;

  v_label := coalesce('#' || v_delivery.tracking_number, '#' || upper(substring(p_delivery_id::text, 1, 8)));
  v_free_cancel := v_delivery.status in ('requested', 'accepted');

  if v_free_cancel then
    select amount into v_deduction_amount
    from wallet_transactions
    where delivery_id = p_delivery_id and type = 'deduction'
      and description not ilike '%shopping funds hold%'
    limit 1;

    if v_deduction_amount is not null then
      v_refund_amount := abs(v_deduction_amount);
      insert into wallet_balances (user_id, balance, updated_at)
      values (v_customer_id, v_refund_amount, now())
      on conflict (user_id) do update
        set balance = wallet_balances.balance + v_refund_amount,
            updated_at = now();
      insert into wallet_transactions (user_id, type, amount, description, delivery_id)
      values (v_customer_id, 'cashback', v_refund_amount, 'Refund for cancelled order ' || v_label, p_delivery_id);
    end if;
  else
    if v_delivery.pickup_lat is not null and v_delivery.pickup_lng is not null
       and v_delivery.delivery_lat is not null and v_delivery.delivery_lng is not null then
      v_distance_miles := 3958.8 * 2 * asin(least(1, sqrt(
        power(sin(radians(v_delivery.delivery_lat - v_delivery.pickup_lat) / 2), 2) +
        cos(radians(v_delivery.pickup_lat)) * cos(radians(v_delivery.delivery_lat)) *
        power(sin(radians(v_delivery.delivery_lng - v_delivery.pickup_lng) / 2), 2)
      )));
      v_cancellation_fee := ceil(v_distance_miles);
    else
      v_cancellation_fee := 5;
      v_distance_miles := 0;
    end if;

    insert into wallet_balances (user_id, balance, updated_at)
    values (v_customer_id, -v_cancellation_fee, now())
    on conflict (user_id) do update
      set balance = wallet_balances.balance - v_cancellation_fee,
          updated_at = now();

    insert into wallet_transactions (user_id, type, amount, description, delivery_id)
    values (
      v_customer_id, 'cancellation_fee', -v_cancellation_fee,
      'Cancellation fee for order ' || v_label || ' (' || round(v_distance_miles::numeric, 1) || ' miles x GBP1)',
      p_delivery_id
    );
  end if;

  update delivery_requests
  set status = 'cancelled', cancelled_by = 'customer'
  where id = p_delivery_id;

  insert into notifications (user_id, title, body)
  values (
    v_customer_id,
    case when v_free_cancel then 'Order Cancelled' else 'Order Cancelled — Fee Applied' end,
    case
      when v_free_cancel and v_refund_amount > 0 then
        'Your order has been cancelled and GBP' || to_char(v_refund_amount, 'FM999999990.00') || ' was refunded to your wallet.'
      when v_free_cancel then
        'Your order has been cancelled at no charge.'
      else
        'Your order was cancelled. A GBP' || v_cancellation_fee || ' cancellation fee was deducted from your wallet.'
    end
  );

  return jsonb_build_object(
    'freeCancel', v_free_cancel,
    'cancellationFee', v_cancellation_fee,
    'distanceMiles', v_distance_miles,
    'refundAmount', v_refund_amount
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.driver_finance_snapshot(p_driver uuid, p_page integer DEFAULT 1, p_period text DEFAULT 'all'::text, p_payouts boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare result jsonb; boundary timestamptz;
begin
 if not exists(select 1 from users where id=p_driver and role='driver') then raise exception 'driver_required'; end if;
 boundary:=case p_period when 'day' then date_trunc('day',now() at time zone 'Europe/London') at time zone 'Europe/London'
 when 'week' then date_trunc('week',now() at time zone 'Europe/London') at time zone 'Europe/London'
 when 'month' then date_trunc('month',now() at time zone 'Europe/London') at time zone 'Europe/London' else '-infinity'::timestamptz end;
 with earnings as (
 select e.id::text,e.amount,e.commission_amount,e.status,(e.created_at at time zone 'UTC') as created_at,coalesce(to_jsonb(d),'{}'::jsonb)||jsonb_build_object('price',coalesce(p.amount,d.price),'adjustment',case when e.source_payment_id is not null then 'Collection waiting' when e.recovery_delivery_id is not null then 'Returned-job payment' else null end) as delivery_requests from driver_earnings e left join payments p on p.id=e.source_payment_id left join delivery_requests d on d.id=coalesce(e.delivery_id,e.recovery_delivery_id,p.related_delivery_id) where e.driver_id=p_driver
 union all
 select 'legacy-'||d.id,coalesce(d.driver_earning_quote,round(d.price*.75,2)),d.price-coalesce(d.driver_earning_quote,round(d.price*.75,2)),'pending',coalesce(d.delivered_at,d.created_at at time zone 'UTC'),to_jsonb(d)
 from delivery_requests d where d.driver_id=p_driver and d.status='delivered' and d.price is not null and not exists(select 1 from driver_earnings e where e.delivery_id=d.id)
 ), totals as(select coalesce(sum(amount),0) total,coalesce(sum(amount) filter(where status='pending'),0) available,
 coalesce(sum(amount) filter(where created_at>=date_trunc('day',now() at time zone 'Europe/London') at time zone 'Europe/London'),0) today,count(*) filter(where created_at>=date_trunc('day',now() at time zone 'Europe/London') at time zone 'Europe/London') today_jobs,count(*) jobs from earnings)
 select jsonb_build_object('totals',(select to_jsonb(t) from totals t),'paid',coalesce((select sum(amount) from payouts where driver_id=p_driver and status='paid'),0),
 'count',case when p_payouts then (select count(*) from payouts where driver_id=p_driver) else (select count(*) from earnings where created_at>=boundary) end,
 'rows',case when p_payouts then (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,amount,status,created_at at time zone 'UTC' as created_at,payment_reference,provider from payouts where driver_id=p_driver order by created_at desc,id desc limit 20 offset (greatest(1,least(p_page,1000000))-1)*20)r)
 else (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,amount,commission_amount,status,created_at,jsonb_build_object('pickup_address',delivery_requests->>'pickup_address','tracking_number',delivery_requests->>'tracking_number','price',delivery_requests->'price','adjustment',delivery_requests->>'adjustment') delivery_requests from earnings where created_at>=boundary order by created_at desc,id desc limit 20 offset (greatest(1,least(p_page,1000000))-1)*20)r) end) into result;
 return result;
end $function$;


alter table public.driver_profiles add column review_decision jsonb;
revoke update(review_decision),insert(review_decision) on public.driver_profiles from public,anon,authenticated;
create or replace function public.admin_review_driver(p_actor uuid,p_driver uuid,p_decision text,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not godrop_private.admin_has_scope(p_actor,'operations') or p_decision not in ('approved','rejected') or length(trim(coalesce(p_reason,'')))<5 then raise exception 'review_reason_required';end if;
 perform set_config('app.admin_actor',p_actor::text,true);
 if p_decision='approved' then perform approve_driver_verification(p_driver,p_actor);
 else update driver_profiles set status='rejected',is_online=false where id=p_driver;if not found then raise exception 'driver_missing';end if;end if;
 update driver_profiles set review_decision=jsonb_build_object('status',p_decision,'actor',p_actor,'reason',left(p_reason,500),'at',now()) where id=p_driver;
 perform append_admin_audit(p_actor,'driver_'||p_decision,p_driver::text,jsonb_build_object('reason',left(p_reason,500)));
end $$;
revoke all on function public.admin_review_driver(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_review_driver(uuid,uuid,text,text) to service_role;

revoke all on function public.admin_wallet_refund(uuid,uuid,numeric,uuid,boolean),public.cancel_card_order(uuid,uuid),public.driver_finance_snapshot(uuid,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.admin_wallet_refund(uuid,uuid,numeric,uuid,boolean),public.cancel_card_order(uuid,uuid),public.driver_finance_snapshot(uuid,integer,text,boolean) to service_role;
revoke all on function public.cancel_delivery_order(uuid) from public,anon;
grant execute on function public.cancel_delivery_order(uuid) to authenticated,service_role;

-- All booking and payment writes go through authenticated server actions/RPCs.
-- Owning a row is not permission to set its price, workflow or payment evidence.
revoke insert,update,delete on public.delivery_requests,public.payments from anon,authenticated;

-- A returned/cancelled job still pays the agreed driver amount once. Service-fee
-- refunds are a separate explicit finance action; unused shopping funds retain
-- their existing automatic refund rules.
alter table public.driver_earnings add column recovery_delivery_id uuid unique references public.delivery_requests(id);
revoke insert(recovery_delivery_id),update(recovery_delivery_id) on public.driver_earnings from public,anon,authenticated;
create or replace function public.resolve_recovery_cancellation(p_actor uuid,p_id uuid,p_reason text,p_return_confirmed boolean,p_card_reference text)
returns void language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype;compensation numeric;
begin
 if not godrop_private.admin_has_scope(p_actor,'finance') or p_return_confirmed is distinct from true or length(trim(coalesce(p_reason,'')))<10 then raise exception 'finance_return_confirmation_required';end if;
 select * into o from delivery_requests where id=p_id for update;
 if not found then raise exception 'order_missing';end if;
 if o.status='cancelled' and o.recovery_case->>'action'='cancel_returned' then return;end if;
 if o.status not in ('accepted','collected','picked_up','in_transit') or o.recovery_case->>'status' is distinct from 'open' then raise exception 'open_recovery_required';end if;
 if o.company_card_reference is distinct from p_card_reference then raise exception 'company_card_changed';end if;
 perform set_config('app.admin_actor',p_actor::text,true);
 update delivery_requests set status='cancelled',cancelled_by='admin',recovery_case=coalesce(recovery_case,'{}')||jsonb_build_object('status','closed','action','cancel_returned','returned_confirmed',true,'reason',left(p_reason,1000),'actor',p_actor,'at',now(),'refund_review_required',true) where id=p_id;
 compensation:=coalesce(o.driver_earning_quote,round(o.price*.75,2));
 if o.driver_id is not null and compensation>0 then insert into driver_earnings(driver_id,amount,commission_amount,status,recovery_delivery_id) values(o.driver_id,compensation,o.price-compensation,'pending',p_id) on conflict(recovery_delivery_id) do nothing;end if;
 delete from driver_locations where delivery_id=p_id;
 insert into delivery_status_logs(delivery_id,status,updated_by) values(p_id,'cancelled',p_actor);
 perform append_admin_audit(p_actor,'returned_order_cancelled',p_id::text,jsonb_build_object('reason',left(p_reason,1000),'agreed_driver_payment',compensation,'refund_review_required',true));
end $$;
revoke all on function public.resolve_recovery_cancellation(uuid,uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.resolve_recovery_cancellation(uuid,uuid,text,boolean,text) to service_role;
