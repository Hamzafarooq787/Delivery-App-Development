-- Reject unrelated customers even when an order has no assigned driver.
create or replace function public.cancellation_quote(p_actor uuid,p_id uuid,p_fault text default 'customer') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o delivery_requests%rowtype; config jsonb; paid numeric:=0; returned numeric:=0; fee numeric:=0; driver_pay numeric:=0; review boolean:=false;
begin
 select * into o from delivery_requests where id=p_id;
 if not found or not coalesce(o.customer_id=p_actor or o.driver_id=p_actor or godrop_private.admin_has_scope(p_actor,'finance'),false)
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
  o.bfm_stage in ('purchase_completed','heading_to_customer'),false);
 if not review and p_fault='customer' and o.driver_id is not null then
  if o.arrived_at is not null then fee:=(config->>'arrivedFee')::numeric;driver_pay:=(config->>'arrivedDriver')::numeric;
  elsif o.travel_started_at is not null then fee:=(config->>'travelFee')::numeric;driver_pay:=(config->>'travelDriver')::numeric;end if;
 end if;
 fee:=least(fee,greatest(0,paid-returned));driver_pay:=least(driver_pay,fee);
 return jsonb_build_object('fee',fee,'driver',driver_pay,'platform',fee-driver_pay,'refund',greatest(0,paid-returned-fee),'review',coalesce(review,false),
 'status',o.status,'canCancel',o.status not in ('cancelled','delivered'),'method',o.payment_method);
end $$;

alter table public.surge_pricing_settings add constraint cancellation_settings_valid check (
 cancellation_settings ?& array['travelFee','travelDriver','arrivedFee','arrivedDriver'] and
 jsonb_typeof(cancellation_settings->'travelFee')='number' and jsonb_typeof(cancellation_settings->'travelDriver')='number' and
 jsonb_typeof(cancellation_settings->'arrivedFee')='number' and jsonb_typeof(cancellation_settings->'arrivedDriver')='number' and
 (cancellation_settings->>'travelFee')::numeric between 0 and 100 and (cancellation_settings->>'arrivedFee')::numeric between 0 and 100 and
 (cancellation_settings->>'travelDriver')::numeric between 0 and (cancellation_settings->>'travelFee')::numeric and
 (cancellation_settings->>'arrivedDriver')::numeric between 0 and (cancellation_settings->>'arrivedFee')::numeric and
 round((cancellation_settings->>'travelFee')::numeric,2)=(cancellation_settings->>'travelFee')::numeric and
 round((cancellation_settings->>'travelDriver')::numeric,2)=(cancellation_settings->>'travelDriver')::numeric and
 round((cancellation_settings->>'arrivedFee')::numeric,2)=(cancellation_settings->>'arrivedFee')::numeric and
 round((cancellation_settings->>'arrivedDriver')::numeric,2)=(cancellation_settings->>'arrivedDriver')::numeric
);
