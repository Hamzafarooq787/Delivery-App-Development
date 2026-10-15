-- Review against the deployed shopping schema before applying.
begin;
alter table public.delivery_requests add column if not exists shopping_started_at timestamptz;
alter table public.shopping_items add column if not exists found_unit_price numeric;
-- Receipt reconciliation is claimed once under a row lock. Stripe refund then
-- uses a stable idempotency key, so webhook retries cannot issue two refunds.
create or replace function public.claim_launch_receipt(p_delivery uuid,p_driver uuid,p_url text,p_actual numeric) returns numeric
language plpgsql security definer set search_path=public as $$
declare d delivery_requests%rowtype;p payments%rowtype;v_refund numeric;
begin
 select * into d from delivery_requests where id=p_delivery for update;
 select * into p from payments where delivery_id=p_delivery for update;
 if d.id is null or d.driver_id is distinct from p_driver or d.launch_quote is null or d.service_type<>'buy_for_me' or p.status not in('paid','released') or p.funding_reference is null then raise exception 'purchase_not_funded';end if;
 if p_actual is null or p_actual<0 or p_actual>p.shopping_funds or p_url is null or p_url='' then raise exception 'invalid_receipt';end if;
 if exists(select 1 from shopping_substitutions where delivery_id=p_delivery and customer_approved is distinct from true and not exists(select 1 from shopping_items i where i.id=shopping_substitutions.shopping_item_id and i.status='unavailable')) then raise exception 'customer_approval_required';end if;
 if exists(select 1 from shopping_items where delivery_id=p_delivery and status='pending') then raise exception 'check_every_item_before_purchase';end if;
 if d.purchase_confirmed_at is not null then
  if d.actual_items_total is distinct from p_actual or d.receipt_url is distinct from p_url then raise exception 'receipt_already_confirmed';end if;
  return coalesce(p.receipt_refund_amount,0);
 end if;
 v_refund:=p.shopping_funds-p_actual;
 update delivery_requests set receipt_url=p_url,actual_items_total=p_actual,purchase_confirmed_at=now(),bfm_stage='purchase_completed' where id=p_delivery;
 update payments set receipt_refund_amount=v_refund,receipt_refund_status=case when v_refund>0 then 'pending' else 'complete' end where id=p.id;
 return v_refund;
end $$;
revoke all on function public.claim_launch_receipt(uuid,uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.claim_launch_receipt(uuid,uuid,text,numeric) to service_role;
create or replace function public.reserve_launch_cancellation(p_delivery uuid,p_customer uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d delivery_requests%rowtype;p payments%rowtype;
begin
 select * into d from delivery_requests where id=p_delivery for update;
 if d.id is null or d.customer_id is distinct from p_customer or d.launch_quote is null or d.driver_id is not null or d.status not in('requested','cancelled') then raise exception 'cancellation_not_available';end if;
 select * into p from payments where delivery_id=p_delivery for update;
 update delivery_requests set status='cancelled' where id=p_delivery;
 return to_jsonb(p);
end $$;
revoke all on function public.reserve_launch_cancellation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_launch_cancellation(uuid,uuid) to service_role;

commit;
