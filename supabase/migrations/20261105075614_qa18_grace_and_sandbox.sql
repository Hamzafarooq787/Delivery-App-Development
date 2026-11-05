-- Keep recorded fee splits; extend old policies with the approved two-minute grace.
update public.surge_pricing_settings set cancellation_settings=cancellation_settings||'{"graceMinutes":2}'::jsonb where not(cancellation_settings ? 'graceMinutes');
alter table public.surge_pricing_settings add constraint cancellation_grace_valid check (
 cancellation_settings ? 'graceMinutes' and jsonb_typeof(cancellation_settings->'graceMinutes')='number' and
 (cancellation_settings->>'graceMinutes')::numeric between 0 and 60 and
 trunc((cancellation_settings->>'graceMinutes')::numeric)=(cancellation_settings->>'graceMinutes')::numeric
);
-- Reject unrelated customers even when an order has no assigned driver.
create or replace function public.cancellation_quote(p_actor uuid,p_id uuid,p_fault text default 'customer') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o delivery_requests%rowtype; config jsonb; paid numeric:=0; returned numeric:=0; fee numeric:=0; driver_pay numeric:=0; review boolean:=false; grace_minutes integer; grace_end timestamptz; grace_seconds integer:=0;
begin
 select * into o from delivery_requests where id=p_id;
 if not found or not coalesce(o.customer_id=p_actor or o.driver_id=p_actor or godrop_private.admin_has_scope(p_actor,'finance'),false)
 then raise exception 'order_unavailable';end if;
 if p_fault not in ('customer','driver','no_show','service_failure','admin') then raise exception 'invalid_reason';end if;
 if p_actor=o.customer_id and p_fault<>'customer' then raise exception 'support_review_required';end if;
 if p_actor=o.driver_id and p_fault<>'driver' then raise exception 'support_review_required';end if;
 select coalesce(o.cancellation_policy->'milestoneFees',cancellation_settings) into config from surge_pricing_settings where id=true;
 select coalesce((config->>'graceMinutes')::integer,(cancellation_settings->>'graceMinutes')::integer,2) into grace_minutes from surge_pricing_settings where id=true;
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
  o.bfm_stage in ('purchase_completed','heading_to_customer'),false);
 if not review and p_fault='customer' and o.driver_id is not null then
  if o.arrived_at is not null then fee:=(config->>'arrivedFee')::numeric;driver_pay:=(config->>'arrivedDriver')::numeric;
  elsif o.travel_started_at is not null then
   grace_end:=o.travel_started_at+make_interval(mins=>grace_minutes);
   grace_seconds:=greatest(0,ceil(extract(epoch from grace_end-clock_timestamp()))::integer);
   if grace_seconds=0 then fee:=(config->>'travelFee')::numeric;driver_pay:=(config->>'travelDriver')::numeric;end if;
  end if;
 end if;
 fee:=least(fee,greatest(0,paid-returned));driver_pay:=least(driver_pay,fee);
 return jsonb_build_object('fee',fee,'driver',driver_pay,'platform',fee-driver_pay,'refund',greatest(0,paid-returned-fee),'review',coalesce(review,false),
 'graceSeconds',grace_seconds,'graceExpiresAt',case when grace_seconds>0 then grace_end else null end,'status',o.status,'canCancel',o.status not in ('cancelled','delivered'),'method',o.payment_method);
end $$;


-- This ledger is a sandbox simulator, never an Issuing funding source.
create table public.shopping_sandbox_sessions (
 delivery_id uuid primary key references public.delivery_requests(id),
 driver_id uuid not null references public.users(id),
 payment_intent text not null,
 created_by uuid not null references public.users(id),
 created_at timestamptz not null default now(),
 simulated_spent numeric check (simulated_spent>=0 and simulated_spent::text not in ('NaN','Infinity','-Infinity'))
);
alter table public.shopping_sandbox_sessions enable row level security;
revoke all on public.shopping_sandbox_sessions from public,anon,authenticated;
grant select,insert,update on public.shopping_sandbox_sessions to service_role;

create function public.enable_shopping_simulation(p_actor uuid,p_id uuid,p_intent text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare o delivery_requests%rowtype;
begin
 if not godrop_private.admin_has_scope(p_actor,'finance') then raise exception 'finance_required';end if;
 select * into o from delivery_requests where id=p_id for update;
 if not found or o.service_type<>'buy_for_me' or o.payment_method<>'stripe' or o.status not in ('accepted','collected') or o.driver_id is null or o.purchase_authorized_at is not null or o.purchased_at is not null or o.shopping_hold_settled_at is not null or (o.recovery_case->>'status')='open' then raise exception 'simulation_unavailable';end if;
 if o.company_card_reference is not null and o.company_card_reference<>'sandbox_'||p_id::text then raise exception 'real_card_assigned';end if;
 if not exists(select 1 from driver_profiles where id=o.driver_id and status='approved') then raise exception 'approved_driver_required';end if;
 perform 1 from payments where delivery_id=p_id and purpose='booking' and status='paid' and stripe_payment_intent=p_intent for share;
 if not found or p_intent is null then raise exception 'paid_test_booking_required';end if;
 insert into shopping_sandbox_sessions(delivery_id,driver_id,payment_intent,created_by) values(p_id,o.driver_id,p_intent,p_actor)
 on conflict(delivery_id) do nothing;
 if not exists(select 1 from shopping_sandbox_sessions where delivery_id=p_id and driver_id=o.driver_id and payment_intent=p_intent) then raise exception 'simulation_identity_changed';end if;
 update delivery_requests set company_card_reference='sandbox_'||p_id::text,company_card_verified_at=now() where id=p_id;
 insert into admin_audit_log(actor_id,event,entity,details) values(p_actor,'shopping_sandbox_enabled',p_id::text,jsonb_build_object('simulation',true,'payment_intent',p_intent));
end $$;
revoke all on function public.enable_shopping_simulation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.enable_shopping_simulation(uuid,uuid,text) to service_role;

create function public.record_sandbox_purchase(p_id uuid,p_driver uuid,p_total numeric) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare o delivery_requests%rowtype;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found or o.driver_id is distinct from p_driver or o.status<>'collected' or o.bfm_stage<>'shopping' or o.company_card_reference is distinct from 'sandbox_'||p_id::text or o.purchase_authorized_at is null or o.shopping_hold_settled_at is not null or (o.recovery_case->>'status')='open' then raise exception 'simulation_not_ready';end if;
 if p_total is null or p_total::text in ('NaN','Infinity','-Infinity') or p_total<0 or p_total>o.max_spend_approved or p_total is distinct from o.purchase_authorized_total then raise exception 'unapproved_basket';end if;
 update shopping_sandbox_sessions set simulated_spent=p_total where delivery_id=p_id and driver_id=p_driver and exists(select 1 from payments where delivery_id=p_id and purpose='booking' and status='paid' and stripe_payment_intent=shopping_sandbox_sessions.payment_intent);
 if not found then raise exception 'simulation_not_enabled';end if;
 update delivery_requests set purchased_at=coalesce(purchased_at,now()) where id=p_id;
end $$;
revoke all on function public.record_sandbox_purchase(uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.record_sandbox_purchase(uuid,uuid,numeric) to service_role;

-- Simulations do not reserve real company Issuing capacity.
CREATE OR REPLACE FUNCTION public.reserve_company_shopping_card(p_id uuid, p_actor uuid, p_card text, p_available numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare job delivery_requests%rowtype; reserved numeric;
begin
 if not exists(select 1 from users where id=p_actor and role='admin') then raise exception 'not_authorized'; end if;
 if p_card is null or p_card !~ '^ic_[a-zA-Z0-9]+$' then raise exception 'invalid_card_reference'; end if;
 perform pg_advisory_xact_lock(hashtextextended('godrop_company_checkout_capacity',0));
 select * into job from delivery_requests where id=p_id for update;
 if not found or job.service_type<>'buy_for_me' or job.status not in ('accepted','collected') or job.driver_id is null or job.purchase_authorized_at is not null or job.bfm_stage in ('purchase_completed','heading_to_customer') then raise exception 'shopping_not_ready'; end if;
 if job.company_card_reference is not null and job.company_card_reference<>p_card then raise exception 'dedicated_card_already_assigned'; end if;
 perform 1 from payments where delivery_id=p_id and status='paid';
 if not found then raise exception 'confirmed_payment_required'; end if;
 if job.max_spend_approved is null or job.max_spend_approved<=0 or job.max_spend_approved>100 then raise exception 'invalid_shopping_budget'; end if;
 select coalesce(sum(coalesce(max_spend_approved,0)),0) into reserved
 from delivery_requests where id<>p_id and service_type='buy_for_me' and company_card_reference is not null
 and company_card_reference not like 'sandbox_%' and status not in ('cancelled','delivered') and shopping_hold_settled_at is null;
 if p_available is null or p_available::text in ('NaN','Infinity','-Infinity') or p_available<reserved+job.max_spend_approved then raise exception 'company_purchase_capacity_unavailable'; end if;
 update delivery_requests set company_card_reference=p_card where id=p_id;
 return p_id;
end $function$;

