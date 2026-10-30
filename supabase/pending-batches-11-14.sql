-- Existing tables only. Apply after the combined acceptance run.
alter table public.driver_earnings add column if not exists payout_id uuid references public.payouts(id);
alter table public.driver_earnings drop constraint if exists driver_earnings_status_check;
alter table public.driver_earnings add constraint driver_earnings_status_check check(status in ('pending','reserved','paid'));
alter table public.payouts add column if not exists payment_reference text;
alter table public.payouts add column if not exists earning_ids uuid[];
create unique index if not exists payout_payment_reference_unique on public.payouts(payment_reference) where payment_reference is not null;
alter table public.surge_pricing_settings add column if not exists platform_settings jsonb not null default '{"name":"GoDrop","email":"","phone":""}';
alter table public.users add column if not exists service_push_enabled boolean not null default true;

create or replace function public.reserve_driver_payout(p_driver uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare ids uuid[]; total numeric; p payouts%rowtype;
begin
 perform 1 from driver_profiles where id=p_driver and status='approved' for update;
 if not found then raise exception 'approved_driver_required'; end if;
 -- Historical paid earnings are never reopened or guessed.
 insert into driver_earnings(driver_id,delivery_id,amount,commission_amount,status)
 select p_driver,d.id,coalesce(d.driver_earning_quote,round(d.price*.75,2)),d.price-coalesce(d.driver_earning_quote,round(d.price*.75,2)),'pending'
 from delivery_requests d where d.driver_id=p_driver and d.status='delivered' and d.price is not null
 on conflict(delivery_id) do nothing;
 select array_agg(id),sum(amount) into ids,total from (select id,amount from driver_earnings where driver_id=p_driver and status='pending' and payout_id is null order by id for update) e;
 if coalesce(total,0)<=0 then return jsonb_build_object('amount',0); end if;
 insert into payouts(driver_id,amount,status,earning_ids) values(p_driver,total,'pending',ids) returning * into p;
 update driver_earnings set status='reserved',payout_id=p.id where id=any(ids);
 return jsonb_build_object('id',p.id,'amount',p.amount);
end $$;
revoke all on function public.reserve_driver_payout(uuid) from public,anon,authenticated;
grant execute on function public.reserve_driver_payout(uuid) to service_role;

create or replace function public.review_driver_payout(p_id uuid,p_actor uuid,p_status text,p_reference text default null) returns void
language plpgsql security definer set search_path=public as $$
declare p payouts%rowtype;
begin
 if not exists(select 1 from users where id=p_actor and role='admin') then raise exception 'admin_required'; end if;
 select * into p from payouts where id=p_id for update;
 if not found then raise exception 'payout_not_found'; end if;
 if p.status=p_status then
  if p_status='paid' and p.payment_reference is distinct from p_reference then raise exception 'reference_mismatch'; end if;
  return;
 end if;
 if p.status not in ('pending','approved') or p_status not in ('approved','rejected','paid') then raise exception 'invalid_transition'; end if;
 if p.earning_ids is null then raise exception 'legacy_payout_requires_reconciliation'; end if;
 if p_status='paid' then
  if length(trim(coalesce(p_reference,'')))<6 or length(p_reference)>150 then raise exception 'verified_bank_reference_required'; end if;
  if (select coalesce(sum(amount),0) from driver_earnings where payout_id=p.id and status='reserved')<>p.amount then raise exception 'earning_claim_mismatch'; end if;
  update driver_earnings set status='paid' where payout_id=p.id and status='reserved';
 elsif p_status='rejected' then
  update driver_earnings set status='pending',payout_id=null where payout_id=p.id and status='reserved';
 end if;
 update payouts set status=p_status,processed_by=p_actor,processed_at=now(),payment_reference=case when p_status='paid' then trim(p_reference) else payment_reference end where id=p_id;
end $$;
revoke all on function public.review_driver_payout(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_driver_payout(uuid,uuid,text,text) to service_role;

create or replace function public.admin_report_snapshot(p_actor uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; boundary timestamp:=now() at time zone 'UTC'-interval '30 days';
begin
 if not exists(select 1 from users where id=p_actor and role='admin') then raise exception 'admin_required'; end if;
 select jsonb_build_object(
 'orders',(select count(*) from delivery_requests where created_at>=boundary),
 'previousOrders',(select count(*) from delivery_requests where created_at>=boundary-interval '30 days' and created_at<boundary),
 'serviceFees',(select coalesce(sum(amount+commission_amount),0) from driver_earnings where created_at>=boundary),
 'driverEarnings',(select coalesce(sum(amount),0) from driver_earnings where created_at>=boundary),
 'commission',(select coalesce(sum(commission_amount),0) from driver_earnings where created_at>=boundary),
 'activeDrivers',(select count(*) from driver_profiles where status='approved' and is_online),
 'newCustomers',(select count(*) from users where role='customer' and created_at>=boundary),
 'statuses',(select coalesce(jsonb_agg(x),'[]') from (select status,count(*) as count from delivery_requests where created_at>=boundary group by status) x),
 'topDrivers',(select coalesce(jsonb_agg(x),'[]') from (select u.id,u.full_name,count(*) as completed from delivery_requests d join users u on u.id=d.driver_id where d.status='delivered' and d.created_at>=boundary group by u.id,u.full_name order by count(*) desc,u.id limit 5) x)
 ) into result;
 return result;
end $$;
revoke all on function public.admin_report_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.admin_report_snapshot(uuid) to service_role;
alter table public.surge_pricing_settings add column if not exists geocode_rate_buckets jsonb not null default '{}';
create or replace function public.claim_public_geocode(p_key text) returns boolean
language plpgsql security definer set search_path=public as $$
declare buckets jsonb; minute bigint:=floor(extract(epoch from now())/60); entry jsonb; total integer; hits integer;
begin
 if p_key !~ '^[a-f0-9]{64}$' then return false; end if;
 select geocode_rate_buckets into buckets from surge_pricing_settings where id=1 for update;
 if not found then return false; end if;
 if (buckets->>'minute')::bigint is distinct from minute then buckets:=jsonb_build_object('minute',minute,'total',0,'clients','{}'::jsonb); end if;
 total:=coalesce((buckets->>'total')::int,0);hits:=coalesce((buckets->'clients'->>p_key)::int,0);
 if total>=60 or hits>=10 then return false; end if;
 buckets:=jsonb_set(buckets,'{total}',to_jsonb(total+1));
 buckets:=jsonb_set(buckets,array['clients',p_key],to_jsonb(hits+1));
 update surge_pricing_settings set geocode_rate_buckets=buckets where id=1;
 return true;
end $$;
revoke all on function public.claim_public_geocode(text) from public,anon,authenticated;
grant execute on function public.claim_public_geocode(text) to service_role;
alter table public.surge_pricing_settings add column if not exists notification_settings jsonb not null default '{}';
alter table public.surge_pricing_settings add column if not exists operations_history jsonb not null default '[]';
create or replace function public.audit_operations_settings() returns trigger language plpgsql set search_path=public as $$
begin
 if new.platform_settings is distinct from old.platform_settings or new.notification_settings is distinct from old.notification_settings then
 new.operations_history:=old.operations_history||jsonb_build_array(jsonb_build_object('at',now(),'platform_before',old.platform_settings,'platform_after',new.platform_settings,'notifications_before',old.notification_settings,'notifications_after',new.notification_settings));
 end if;
 return new;
end $$;
create trigger audit_operations_settings before update on public.surge_pricing_settings for each row execute function public.audit_operations_settings();
alter table public.delivery_requests add column if not exists shopping_timeline jsonb not null default '[]';
create or replace function public.record_shopping_timeline() returns trigger language plpgsql set search_path=public as $$
begin
 if new.service_type='buy_for_me' and (new.bfm_stage is distinct from old.bfm_stage or new.shopping_problem is distinct from old.shopping_problem) then
 new.shopping_timeline:=old.shopping_timeline||jsonb_build_array(jsonb_build_object('at',now(),'stage',new.bfm_stage,'previous_stage',old.bfm_stage,'driver_id',new.driver_id,'actor_id',auth.uid(),'problem',new.shopping_problem));
 end if;
 return new;
end $$;
create trigger record_shopping_timeline before update on public.delivery_requests for each row execute function public.record_shopping_timeline();
revoke all on function public.audit_operations_settings() from public,anon,authenticated;
revoke all on function public.record_shopping_timeline() from public,anon,authenticated;
alter table public.wallet_transactions add column if not exists refund_request_key uuid;
create unique index if not exists wallet_refund_request_unique on public.wallet_transactions(refund_request_key) where refund_request_key is not null;
create or replace function public.admin_wallet_refund(p_order uuid,p_actor uuid,p_amount numeric,p_key uuid,p_cancel boolean default false) returns numeric
language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype; paid numeric; refunded numeric; previous wallet_transactions%rowtype;
begin
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
end $$;
revoke all on function public.admin_wallet_refund(uuid,uuid,numeric,uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_wallet_refund(uuid,uuid,numeric,uuid,boolean) to service_role;
-- Payout mutations must use the protected transactional server workflow.
revoke insert,update,delete on public.payouts,public.driver_earnings from anon,authenticated;
create or replace function public.admin_payout_snapshot(p_actor uuid,p_page int default 1) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not exists(select 1 from users where id=p_actor and role='admin') then raise exception 'admin_required'; end if;
 select jsonb_build_object(
 'stats',jsonb_build_object(
 'pendingRequestCount',(select count(*) from payouts where status in ('pending','approved')),
 'pendingAmount',(select coalesce(sum(amount),0) from payouts where status in ('pending','approved')),
 'totalPaidOut',(select coalesce(sum(amount),0) from payouts where status='paid'),
 'driversAwaiting',(select count(distinct driver_id) from payouts where status in ('pending','approved')),
 'platformCommission',(select coalesce(sum(commission_amount),0) from driver_earnings),
 'totalPayoutCount',(select count(*) from payouts)),
 'payouts',(select coalesce(jsonb_agg(x),'[]') from (select p.*,jsonb_build_object('full_name',coalesce(u.full_name,'Driver'),'email',u.email,'phone',u.phone) as driver,
 jsonb_build_object('totalEarned',coalesce(e.total,0),'pendingEarnings',coalesce(e.pending,0),'completedDeliveries',coalesce(e.jobs,0)) as "driverStats"
 from payouts p join users u on u.id=p.driver_id left join lateral(select sum(amount) total,sum(amount) filter(where status='pending') pending,count(*) jobs from driver_earnings where driver_id=p.driver_id) e on true
 order by p.created_at desc,p.id limit 100 offset greatest(0,p_page-1)*100) x),
 'pendingDrivers',(select coalesce(jsonb_agg(x),'[]') from (select u.id as "driverId",u.full_name,u.email,u.phone,sum(e.amount) filter(where e.status='pending') as pending,sum(e.amount) as total,count(*) as jobs from driver_earnings e join users u on u.id=e.driver_id group by u.id,u.full_name,u.email,u.phone having sum(e.amount) filter(where e.status='pending')>0 order by u.id limit 100 offset greatest(0,p_page-1)*100) x)) into result;
 return result;
end $$;
revoke all on function public.admin_payout_snapshot(uuid,int) from public,anon,authenticated;
grant execute on function public.admin_payout_snapshot(uuid,int) to service_role;
create or replace function public.admin_attention_queue(p_actor uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not exists(select 1 from users where id=p_actor and role='admin') then raise exception 'admin_required'; end if;
 select coalesce(jsonb_agg(x),'[]') into result from (
 select id,reason,at from (
 select d.id,'Shop problem reported'::text reason,d.created_at at from delivery_requests d where d.status not in ('cancelled','delivered') and d.shopping_problem is not null
 union all select s.delivery_id,'Customer approval pending',s.created_at from shopping_substitutions s join delivery_requests d on d.id=s.delivery_id where s.customer_approved is null and d.status not in ('cancelled','delivered')
 union all select p.delivery_id,'Card refund needs attention',p.created_at from payments p where p.delivery_id is not null and exists(select 1 from jsonb_array_elements(p.refund_jobs) r where r->>'status' in ('failed','requires_action'))
 ) q order by at,id limit 100) x;
 return result;
end $$;
revoke all on function public.admin_attention_queue(uuid) from public,anon,authenticated;
grant execute on function public.admin_attention_queue(uuid) to service_role;
