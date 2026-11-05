alter table public.surge_pricing_settings add column cancellation_settings jsonb not null default '{"travelFee":2.50,"travelDriver":2.00,"arrivedFee":3.50,"arrivedDriver":3.00}';
alter table public.delivery_requests
 add column accepted_at timestamptz,
 add column travel_started_at timestamptz,
 add column arrived_at timestamptz,
 add column purchased_at timestamptz,
 add column cancellation_outcome jsonb;
alter table public.driver_profiles add column declined_jobs uuid[] not null default '{}';

create function public.record_collection_milestones() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' then
  if current_setting('role',true) in ('anon','authenticated') and (new.accepted_at is not null or new.travel_started_at is not null or new.arrived_at is not null or new.purchased_at is not null or new.cancellation_outcome is not null) then raise exception 'server_managed_milestones';end if;
  return new;
 end if;
 if tg_op='UPDATE' then
  if old.driver_id is distinct from new.driver_id then
   new.accepted_at:=case when new.driver_id is not null then now() else null end;
   new.travel_started_at:=null;new.arrived_at:=null;
  elsif old.status='requested' and new.status='accepted' then new.accepted_at:=now();end if;
  if new.bfm_stage is distinct from old.bfm_stage then
   if new.bfm_stage='heading_to_shop' then new.travel_started_at:=coalesce(old.travel_started_at,now());end if;
   if new.bfm_stage in ('arrived_at_shop','shopping') then
    new.travel_started_at:=coalesce(new.travel_started_at,now());new.arrived_at:=coalesce(old.arrived_at,now());
   end if;
  end if;
  if old.status='accepted' and new.status='collected' and new.service_type<>'buy_for_me' then new.arrived_at:=coalesce(old.arrived_at,now());end if;
  if old.purchase_confirmed_at is null and new.purchase_confirmed_at is not null then new.purchased_at:=new.purchase_confirmed_at;end if;
  if current_setting('role',true) in ('anon','authenticated') and
   (new.accepted_at,new.travel_started_at,new.arrived_at,new.purchased_at,new.cancellation_outcome)
    is distinct from (old.accepted_at,old.travel_started_at,old.arrived_at,old.purchased_at,old.cancellation_outcome)
   then raise exception 'server_managed_milestones';end if;
 end if;
 return new;
end $$;
revoke all on function public.record_collection_milestones() from public,anon,authenticated;
create trigger record_collection_milestones before insert or update on public.delivery_requests for each row execute function public.record_collection_milestones();

create function public.collection_milestone(p_actor uuid,p_id uuid,p_stage text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare o delivery_requests%rowtype;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found or o.driver_id is distinct from p_actor or o.status<>'accepted'
  or not exists(select 1 from driver_profiles d join users u on u.id=d.id where d.id=p_actor and d.status='approved' and u.account_status='active')
 then raise exception 'assigned_approved_driver_required';end if;
 if p_stage='travel' then
  update delivery_requests set travel_started_at=coalesce(travel_started_at,now()) where id=p_id;
 elsif p_stage='arrived' and o.travel_started_at is not null then
  update delivery_requests set arrived_at=coalesce(arrived_at,now()) where id=p_id;
 else raise exception 'start_journey_before_arrival';end if;
end $$;
revoke all on function public.collection_milestone(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.collection_milestone(uuid,uuid,text) to service_role;

create function public.cancellation_quote(p_actor uuid,p_id uuid,p_fault text default 'customer') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o delivery_requests%rowtype; config jsonb; paid numeric:=0; returned numeric:=0; fee numeric:=0; driver_pay numeric:=0; review boolean:=false;
begin
 select * into o from delivery_requests where id=p_id;
 if not found or not(o.customer_id=p_actor or o.driver_id=p_actor or godrop_private.admin_has_scope(p_actor,'finance'))
 then raise exception 'order_unavailable';end if;
 if p_fault not in ('customer','driver','no_show','service_failure','admin') then raise exception 'invalid_reason';end if;
 if p_actor=o.customer_id and p_fault<>'customer' then raise exception 'support_review_required';end if;
 if p_actor=o.driver_id and p_fault<>'driver' then raise exception 'support_review_required';end if;
 select coalesce(o.cancellation_policy->'milestoneFees',cancellation_settings) into config from surge_pricing_settings where id=true;
 if config is null then raise exception 'policy_unavailable';end if;
 if o.payment_method='stripe' then
  select p.amount,coalesce((select sum((r->>'amount')::numeric) from jsonb_array_elements(p.refund_jobs) r where r->>'state' not in ('failed','canceled')),0) into paid,returned
  from payments p where p.delivery_id=p_id and p.purpose='booking' and p.status='paid';
 else
  select coalesce(sum(amount) filter(where type='deduction'),0),coalesce(sum(amount) filter(where type='cashback'),0) into paid,returned
  from wallet_transactions where delivery_id=p_id and user_id=o.customer_id;
 end if;
 paid:=coalesce(paid,0);returned:=coalesce(returned,0);
 review:=coalesce(o.purchased_at is not null or o.purchase_confirmed_at is not null or
  o.bfm_stage in ('purchase_completed','heading_to_customer') or
  (o.service_type<>'buy_for_me' and o.status in ('collected','picked_up','in_transit')),false);
 if not review and p_fault='customer' and o.driver_id is not null then
  if o.arrived_at is not null then fee:=(config->>'arrivedFee')::numeric;driver_pay:=(config->>'arrivedDriver')::numeric;
  elsif o.travel_started_at is not null then fee:=(config->>'travelFee')::numeric;driver_pay:=(config->>'travelDriver')::numeric;end if;
 end if;
 fee:=least(fee,greatest(0,paid-returned));driver_pay:=least(driver_pay,fee);
 return jsonb_build_object('fee',fee,'driver',driver_pay,'platform',fee-driver_pay,'refund',greatest(0,paid-returned-fee),'review',coalesce(review,false),
 'status',o.status,'canCancel',o.status not in ('cancelled','delivered'),'method',o.payment_method);
end $$;
revoke all on function public.cancellation_quote(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.cancellation_quote(uuid,uuid,text) to service_role;

create function public.cancel_with_policy(p_actor uuid,p_id uuid,p_fee numeric,p_reason text,p_fault text default 'customer') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o delivery_requests%rowtype;q jsonb;amount numeric;compensation numeric;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found then raise exception 'order_unavailable';end if;
 q:=cancellation_quote(p_actor,p_id,p_fault);
 if o.status='cancelled' then return coalesce(o.cancellation_outcome,q);end if;
 if o.status='delivered' then raise exception 'order_closed';end if;
 if char_length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'cancellation_reason_required';end if;
 if (q->>'review')::boolean then
  update delivery_requests set recovery_case=coalesce(recovery_case,'{}')||jsonb_build_object('status','open','action','cancellation_review','reason',p_reason,'actor',p_actor,'at',now(),'purchase_review',true) where id=p_id;
  return q||jsonb_build_object('review',true);
 end if;
 if p_fee is null or p_fee is distinct from (q->>'fee')::numeric then raise exception 'cancellation_fee_changed';end if;
 amount:=(q->>'refund')::numeric;compensation:=(q->>'driver')::numeric;
 perform set_config('app.admin_actor',p_actor::text,true);
 if o.payment_method='stripe' then
  if amount>0 then perform queue_order_refund(p_id,'cancel-order',amount);end if;
 else
  if amount>0 then
   insert into wallet_transactions(user_id,type,amount,description,delivery_id) values(o.customer_id,'cashback',amount,'Cancellation refund',p_id);
   insert into wallet_balances(user_id,balance,updated_at) values(o.customer_id,amount,now()) on conflict(user_id) do update set balance=wallet_balances.balance+excluded.balance,updated_at=now();
  end if;
 end if;
 q:=q||jsonb_build_object('reason',left(trim(p_reason),500),'fault',p_fault,'at',now(),'actor',p_actor);
 update delivery_requests set status='cancelled',cancelled_by=case when p_actor=o.customer_id then 'customer' when p_actor=o.driver_id then 'driver' else 'admin' end,cancellation_outcome=q,
 shopping_hold_settled_at=case when service_type='buy_for_me' then now() else shopping_hold_settled_at end where id=p_id;
 if o.driver_id is not null and compensation>0 then
  insert into driver_earnings(driver_id,recovery_delivery_id,amount,commission_amount,status) values(o.driver_id,p_id,compensation,(q->>'platform')::numeric,'pending') on conflict(recovery_delivery_id) do nothing;
 end if;
 insert into admin_audit_log(actor_id,event,entity,details) values(p_actor,'policy_cancellation',p_id::text,q);
 return q;
end $$;
revoke all on function public.cancel_with_policy(uuid,uuid,numeric,text,text) from public,anon,authenticated;
grant execute on function public.cancel_with_policy(uuid,uuid,numeric,text,text) to service_role;

-- Older clients cannot silently bypass a newly applicable fee.
create or replace function public.cancel_card_order(p_id uuid,p_actor uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare fault text;
begin
 select case when customer_id=p_actor then 'customer' when driver_id=p_actor then 'driver' else 'admin' end into fault from delivery_requests where id=p_id;
 return cancel_with_policy(p_actor,p_id,0,'Cancellation requested',fault);
end $$;
create or replace function public.cancel_delivery_order(p_delivery_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin return cancel_with_policy(auth.uid(),p_delivery_id,0,'Customer cancellation','customer');end $$;

create function public.decline_driver_job(p_actor uuid,p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from users u join driver_profiles d on d.id=u.id where u.id=p_actor and u.role='driver' and u.account_status='active' and d.status='approved') then raise exception 'approved_driver_required';end if;
 if not exists(select 1 from delivery_requests where id=p_id and status='requested' and driver_id is null) then raise exception 'job_unavailable';end if;
 update driver_profiles set declined_jobs=array(select distinct v from unnest(declined_jobs||array[p_id]) v limit 1000) where id=p_actor;
end $$;
revoke all on function public.decline_driver_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.decline_driver_job(uuid,uuid) to service_role;

create view public.admin_payment_ledger with (security_invoker=true) as
select p.*,d.tracking_number,
 case when r.returned>0 and round(r.returned*100)>=round(p.amount*100) then 'refunded'
 when r.returned>0 then 'partially_refunded'
 when exists(select 1 from jsonb_array_elements(coalesce(p.refund_jobs,'[]')) x where x->>'state' in ('pending','requires_action')) then 'refund_pending'
 else p.status end as display_status
from payments p left join delivery_requests d on d.id=coalesce(p.delivery_id,p.related_delivery_id)
cross join lateral (select coalesce(sum((x->>'amount')::numeric) filter(where x->>'state'='succeeded'),0) returned from jsonb_array_elements(coalesce(p.refund_jobs,'[]')) x) r;
revoke all on public.admin_payment_ledger from public,anon,authenticated;
grant select on public.admin_payment_ledger to service_role;

create function public.hold_cancellation_review() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if old.recovery_case->>'status'='open' and old.recovery_case->>'action'='cancellation_review'
 and new.recovery_case is not distinct from old.recovery_case and
 (new.status,new.bfm_stage,new.purchase_confirmed_at) is distinct from (old.status,old.bfm_stage,old.purchase_confirmed_at)
 then raise exception 'admin_cancellation_review_required';end if;
 return new;
end $$;
revoke all on function public.hold_cancellation_review() from public,anon,authenticated;
create trigger hold_cancellation_review before update on public.delivery_requests for each row execute function public.hold_cancellation_review();

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
 select e.id::text,e.amount,e.commission_amount,e.status,(e.created_at at time zone 'UTC') as created_at,coalesce(to_jsonb(d),'{}'::jsonb)||jsonb_build_object('price',coalesce(p.amount,d.price),'adjustment',case when e.source_payment_id is not null then 'Collection waiting' when e.recovery_delivery_id is not null and d.cancellation_outcome is not null then 'Cancellation compensation' when e.recovery_delivery_id is not null then 'Returned-job payment' else null end) as delivery_requests from driver_earnings e left join payments p on p.id=e.source_payment_id left join delivery_requests d on d.id=coalesce(e.delivery_id,e.recovery_delivery_id,p.related_delivery_id) where e.driver_id=p_driver
 union all
 select 'legacy-'||d.id,coalesce(d.driver_earning_quote,round(d.price*.75,2)),d.price-coalesce(d.driver_earning_quote,round(d.price*.75,2)),'pending',coalesce(d.delivered_at,d.created_at at time zone 'UTC'),to_jsonb(d)
 from delivery_requests d where d.driver_id=p_driver and d.status='delivered' and d.price is not null and not exists(select 1 from driver_earnings e where e.delivery_id=d.id)
 ), totals as(select coalesce(sum(amount),0) total,coalesce(sum(amount) filter(where status='pending'),0) available,
 coalesce(sum(amount) filter(where created_at>=date_trunc('day',now() at time zone 'Europe/London') at time zone 'Europe/London'),0) today,count(*) filter(where created_at>=date_trunc('day',now() at time zone 'Europe/London') at time zone 'Europe/London') today_jobs,count(*) jobs from earnings where created_at>=boundary)
 select jsonb_build_object('totals',(select to_jsonb(t) from totals t),'paid',coalesce((select sum(amount) from payouts where driver_id=p_driver and status='paid' and coalesce(processed_at,created_at at time zone 'UTC')>=boundary),0),
 'count',case when p_payouts then (select count(*) from payouts where driver_id=p_driver) else (select count(*) from earnings where created_at>=boundary) end,
 'rows',case when p_payouts then (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,amount,status,created_at at time zone 'UTC' as created_at,payment_reference,provider from payouts where driver_id=p_driver order by created_at desc,id desc limit 20 offset (greatest(1,least(p_page,1000000))-1)*20)r)
 else (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,amount,commission_amount,status,created_at,jsonb_build_object('pickup_address',delivery_requests->>'pickup_address','tracking_number',delivery_requests->>'tracking_number','price',delivery_requests->'price','adjustment',delivery_requests->>'adjustment') delivery_requests from earnings where created_at>=boundary order by created_at desc,id desc limit 20 offset (greatest(1,least(p_page,1000000))-1)*20)r) end) into result;
 return result;
end $function$;

-- Preserve legacy behaviour for old paths, but let the new atomic policy own
-- every cashback for policy cancellations. No second trigger may credit money.
do $patch$
declare f text; definition text;
begin
 foreach f in array array['handle_driver_cancellation','refund_cancelled_shopping_hold'] loop
  if to_regprocedure('public.'||f||'()') is not null then
   select pg_get_functiondef(to_regprocedure('public.'||f||'()')) into definition;
   definition:=regexp_replace(definition,'\mBEGIN\M','BEGIN IF new.cancellation_outcome IS NOT NULL THEN RETURN new; END IF;','i');
   execute definition;
  end if;
 end loop;
end $patch$;


-- Keep the cancellation terms attached to new paid bookings.
create function public.snapshot_milestone_cancellation_policy() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare settings jsonb;
begin
 select cancellation_settings into settings from surge_pricing_settings where id=true;
 if settings is null then raise exception 'cancellation_policy_unavailable';end if;
 new.cancellation_policy:=coalesce(new.cancellation_policy,'{}')||jsonb_build_object('milestoneFees',settings,'version',1);
 return new;
end $$;
revoke all on function public.snapshot_milestone_cancellation_policy() from public,anon,authenticated;
create trigger zz_snapshot_milestone_cancellation_policy before insert on public.delivery_requests for each row execute function public.snapshot_milestone_cancellation_policy();
