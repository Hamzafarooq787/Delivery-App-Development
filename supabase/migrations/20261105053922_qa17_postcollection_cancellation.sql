-- The agreed parcel fees also apply after collection. Preserve a safe-return case.
create or replace function public.cancellation_quote(p_actor uuid,p_id uuid,p_fault text default 'customer') returns jsonb
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
  o.bfm_stage in ('purchase_completed','heading_to_customer'),false);
 if not review and p_fault='customer' and o.driver_id is not null then
  if o.arrived_at is not null then fee:=(config->>'arrivedFee')::numeric;driver_pay:=(config->>'arrivedDriver')::numeric;
  elsif o.travel_started_at is not null then fee:=(config->>'travelFee')::numeric;driver_pay:=(config->>'travelDriver')::numeric;end if;
 end if;
 fee:=least(fee,greatest(0,paid-returned));driver_pay:=least(driver_pay,fee);
 return jsonb_build_object('fee',fee,'driver',driver_pay,'platform',fee-driver_pay,'refund',greatest(0,paid-returned-fee),'review',coalesce(review,false),
 'status',o.status,'canCancel',o.status not in ('cancelled','delivered'),'method',o.payment_method);
end $$;
create or replace function public.cancel_with_policy(p_actor uuid,p_id uuid,p_fee numeric,p_reason text,p_fault text default 'customer') returns jsonb
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
 recovery_case=case when o.service_type<>'buy_for_me' and o.status in ('collected','picked_up','in_transit') then coalesce(o.recovery_case,'{}')||jsonb_build_object('status','open','action','return_to_pickup','reason','Cancelled after collection. Contact support to arrange a safe return to collection.','actor',p_actor,'at',now()) else o.recovery_case end,
 shopping_hold_settled_at=case when service_type='buy_for_me' then now() else shopping_hold_settled_at end where id=p_id;
 if o.driver_id is not null and compensation>0 then
  insert into driver_earnings(driver_id,recovery_delivery_id,amount,commission_amount,status) values(o.driver_id,p_id,compensation,(q->>'platform')::numeric,'pending') on conflict(recovery_delivery_id) do nothing;
 end if;
 insert into admin_audit_log(actor_id,event,entity,details) values(p_actor,'policy_cancellation',p_id::text,q);
 return q;
end $$;
