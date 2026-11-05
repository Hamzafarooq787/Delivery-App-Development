-- Keep the existing BfM stage constraint; the main status is the terminal delivery state.
alter table public.delivery_requests add column assignment_history jsonb not null default '[]'::jsonb check(jsonb_typeof(assignment_history)='array');

create or replace function public.record_collection_milestones() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' then
  if current_setting('role',true) in ('anon','authenticated') and (new.accepted_at is not null or new.travel_started_at is not null or new.arrived_at is not null or new.purchased_at is not null or new.cancellation_outcome is not null) then raise exception 'server_managed_milestones';end if;
  if current_setting('role',true) in ('anon','authenticated') and new.assignment_history<>'[]'::jsonb then raise exception 'server_managed_assignment_history';end if;
  return new;
 end if;
 if tg_op='UPDATE' then
  if old.driver_id is distinct from new.driver_id then
   if old.driver_id is not null then
    new.assignment_history:=old.assignment_history||jsonb_build_array(jsonb_build_object('driver_id',old.driver_id,'accepted_at',old.accepted_at,'travel_started_at',old.travel_started_at,'arrived_at',old.arrived_at,'ended_at',clock_timestamp(),'end_status',new.status));
   end if;
   if new.service_type='buy_for_me' and new.purchase_authorized_at is null and new.company_card_reference is null then new.bfm_stage:=null;end if;
   new.accepted_at:=case when new.driver_id is not null then now() else null end;
   new.travel_started_at:=null;new.arrived_at:=null;
  elsif old.status='requested' and new.status='accepted' then new.accepted_at:=now();end if;
  if old.driver_id is not distinct from new.driver_id and new.bfm_stage is distinct from old.bfm_stage then
   if new.bfm_stage='heading_to_shop' then new.travel_started_at:=coalesce(old.travel_started_at,now());end if;
   if new.bfm_stage in ('arrived_at_shop','shopping') then
    new.travel_started_at:=coalesce(new.travel_started_at,now());new.arrived_at:=coalesce(old.arrived_at,now());
   end if;
  end if;
  if old.status='accepted' and new.status='collected' and new.service_type<>'buy_for_me' then new.arrived_at:=coalesce(old.arrived_at,now());end if;
  if old.purchase_confirmed_at is null and new.purchase_confirmed_at is not null then new.purchased_at:=new.purchase_confirmed_at;end if;
  if current_setting('role',true) in ('anon','authenticated') and
   (new.accepted_at,new.travel_started_at,new.arrived_at,new.purchased_at,new.cancellation_outcome,new.assignment_history)
    is distinct from (old.accepted_at,old.travel_started_at,old.arrived_at,old.purchased_at,old.cancellation_outcome,old.assignment_history)
   then raise exception 'server_managed_milestones';end if;
 end if;
 return new;
end $$;

CREATE OR REPLACE FUNCTION public.complete_order_with_otp(p_id uuid, p_driver uuid, p_code text, p_photo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o delivery_requests%rowtype; code delivery_otps%rowtype;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found or o.driver_id is distinct from p_driver or length(coalesce(p_photo,''))=0 then return jsonb_build_object('error','Order is not ready for completion'); end if;
 if o.recovery_case->>'status'='open' then return jsonb_build_object('error','Delivery paused for support. Ask admin to close the review before completing.');end if;
 select * into code from delivery_otps where delivery_id=p_id for update;
 if o.status='delivered' and code.verified_at is not null and trim(p_code)=code.otp then return jsonb_build_object('success',true); end if;
 if o.status<>'in_transit' or (o.service_type='buy_for_me' and (o.bfm_stage is distinct from 'heading_to_customer' or o.receipt_url is null or o.purchase_confirmed_at is null)) then return jsonb_build_object('error','Order is not ready for completion'); end if;
 if code.delivery_id is null or code.attempts>=5 then return jsonb_build_object('error','Contact support for a new delivery code'); end if;
 if trim(p_code) is distinct from code.otp then
  update delivery_otps set attempts=attempts+1 where delivery_id=p_id;
  return jsonb_build_object('error','Incorrect delivery code','attemptsRemaining',greatest(0,4-code.attempts));
 end if;
 update delivery_requests set status='delivered',delivered_at=now(),delivered_image_url=p_photo where id=p_id;
 update delivery_otps set verified_at=now() where delivery_id=p_id;
 insert into delivery_status_logs(delivery_id,status,updated_by) values(p_id,'delivered',p_driver);
 delete from driver_locations where driver_id=p_driver and delivery_id=p_id;
 return jsonb_build_object('success',true);
end $function$;

CREATE OR REPLACE FUNCTION public.resolve_recovery_cancellation(p_actor uuid, p_id uuid, p_reason text, p_return_confirmed boolean, p_card_reference text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o delivery_requests%rowtype;compensation numeric;paid numeric:=0;returned numeric:=0;remaining numeric:=0;
begin
 if not godrop_private.admin_has_scope(p_actor,'finance') or p_return_confirmed is distinct from true or length(trim(coalesce(p_reason,'')))<10 then raise exception 'finance_return_confirmation_required';end if;
 select * into o from delivery_requests where id=p_id for update;
 if not found then raise exception 'order_missing';end if;
 if o.status='cancelled' and o.recovery_case->>'action'='cancel_returned' then return;end if;
 if o.status not in ('accepted','collected','picked_up','in_transit') or o.recovery_case->>'status' is distinct from 'open' then raise exception 'open_recovery_required';end if;
 if o.company_card_reference is distinct from p_card_reference then raise exception 'company_card_changed';end if;
 if o.payment_method='stripe' then
  select p.amount,coalesce((select sum((r->>'amount')::numeric) from jsonb_array_elements(p.refund_jobs) r where r->>'state' not in ('failed','canceled')),0) into paid,returned from payments p where p.delivery_id=p_id and p.purpose='booking' and p.status='paid' for update;
 else
  select coalesce(sum(amount) filter(where type='deduction'),0),coalesce(sum(amount) filter(where type='cashback'),0) into paid,returned from wallet_transactions where delivery_id=p_id and user_id=o.customer_id;
 end if;
 remaining:=greatest(0,coalesce(paid,0)-coalesce(returned,0));
 if remaining>0 then
  if o.payment_method='stripe' then perform queue_order_refund(p_id,'returned-order-cancellation',remaining);
  else
   insert into wallet_balances(user_id,balance) values(o.customer_id,0) on conflict do nothing;
   update wallet_balances set balance=balance+remaining,updated_at=now() where user_id=o.customer_id;
   insert into wallet_transactions(user_id,type,amount,description,delivery_id) values(o.customer_id,'cashback',remaining,'Returned order cancellation refund',p_id);
  end if;
 end if;
 compensation:=case when o.recovery_case->>'fault'='driver' then 0 else coalesce(o.driver_earning_quote,round(o.price*.75,2)) end;
 perform set_config('app.admin_actor',p_actor::text,true);
 update delivery_requests set status='cancelled',cancelled_by='admin',cancellation_outcome=jsonb_build_object('fee',0,'driver',compensation,'platform',0,'refund',remaining,'reason',left(p_reason,1000),'fault','admin','at',now()),recovery_case=coalesce(recovery_case,'{}')||jsonb_build_object('status','closed','action','cancel_returned','returned_confirmed',true,'reason',left(p_reason,1000),'actor',p_actor,'at',now(),'refund_review_required',false) where id=p_id;

 if o.driver_id is not null and compensation>0 then insert into driver_earnings(driver_id,amount,commission_amount,status,recovery_delivery_id) values(o.driver_id,compensation,o.price-compensation,'pending',p_id) on conflict(recovery_delivery_id) do nothing;end if;
 delete from driver_locations where delivery_id=p_id;
 insert into delivery_status_logs(delivery_id,status,updated_by) values(p_id,'cancelled',p_actor);
 perform append_admin_audit(p_actor,'returned_order_cancelled',p_id::text,jsonb_build_object('reason',left(p_reason,1000),'agreed_driver_payment',compensation,'refund_requested',remaining,'refund_review_required',false));
end $function$;

-- Safety release pauses dispatch for review. It is not a driver-fault cancellation.
create function public.request_safety_release(p_actor uuid,p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare o delivery_requests%rowtype;
begin
 if p_actor is null or length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>120 then raise exception 'release_reason_required';end if;
 select * into o from delivery_requests where id=p_id for update;
 if not found or o.driver_id is distinct from p_actor or o.status<>'accepted' or o.company_card_reference is not null or o.purchase_authorized_at is not null or o.purchased_at is not null then raise exception 'contact_support_for_handover';end if;
 update delivery_requests set driver_id=null,status='requested',recovery_case=jsonb_build_object('status','open','action','safety_release_review','reason',p_reason,'actor',p_actor,'at',clock_timestamp(),'customer_fee',0) where id=p_id;
 insert into delivery_status_logs(delivery_id,status,updated_by) values(p_id,'safety_release: '||p_reason,p_actor);
 delete from driver_locations where delivery_id=p_id;
end $$;
revoke all on function public.request_safety_release(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.request_safety_release(uuid,uuid,text) to service_role;

create function public.guard_safety_release_assignment() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.driver_id is not null and (old.driver_id is distinct from new.driver_id or old.status='requested' and new.status='accepted') and new.recovery_case->>'status'='open' and new.recovery_case->>'action'='safety_release_review' then raise exception 'safety_review_required';end if;
 return new;
end $$;
revoke all on function public.guard_safety_release_assignment() from public,anon,authenticated;
create trigger guard_safety_release_assignment before update on public.delivery_requests for each row execute function public.guard_safety_release_assignment();

CREATE OR REPLACE FUNCTION public.notify_delivery_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare staff record;cycle text:=gen_random_uuid()::text;body text;title text;
begin
 if tg_op='INSERT' then
  for staff in select id from users where role='admin' and account_status='active' and (admin_access->>'owner'='true' or admin_access->'scopes'?'operations') loop
   perform godrop_private.notice(staff.id,'New Shipment Request','A new order has been created.','/dashboard/admin/orders/'||new.id,new.id,'order','created:'||new.id||':'||staff.id);
  end loop;
 elsif old.driver_id is distinct from new.driver_id or old.status is distinct from new.status or (old.recovery_case->>'action'='safety_release_review' and old.recovery_case->>'status'='open' and new.recovery_case->>'status'='closed' and new.status='requested') then
  if old.driver_id is distinct from new.driver_id then
   if old.driver_id is not null then perform godrop_private.notice(old.driver_id,'Job assignment changed','This job is no longer assigned to you. Your job list has been updated.','/dashboard/driver/active-jobs',new.id,'order',cycle||':old-driver');end if;
   if new.driver_id is not null then perform godrop_private.notice(new.driver_id,'Job assigned','Open your assigned job to review the route and instructions.','/dashboard/driver/jobs/'||new.id,new.id,'order',cycle||':new-driver');end if;
  end if;
  title:=case when new.status='requested' and new.recovery_case->>'status'='open' and new.recovery_case->>'action'='safety_release_review' then 'Delivery paused for safety review' else case new.status when 'requested' then 'Finding a replacement driver' when 'accepted' then 'Driver assigned' when 'collected' then 'Package Picked Up' when 'picked_up' then 'Package Picked Up' when 'in_transit' then 'In Transit' when 'delivered' then 'Delivered!' when 'cancelled' then 'Order Cancelled' else 'Delivery updated' end end;
  body:=case when new.status='requested' and new.recovery_case->>'status'='open' and new.recovery_case->>'action'='safety_release_review' then 'Your driver reported a safety concern. Dispatch is paused while support arranges a replacement or cancellation. No customer cancellation fee was applied. Open the order for support or free cancellation.' else 'Open your order for its latest status.' end;
  perform godrop_private.notice(new.customer_id,title,body,'/dashboard/customer/tracking?id='||new.id,new.id,'order',cycle||':customer');
  if new.status='cancelled' and new.driver_id is not null then perform godrop_private.notice(new.driver_id,'Order Cancelled','This order is cancelled. Open the job for its final state.','/dashboard/driver/jobs/'||new.id,new.id,'order',cycle||':cancel-driver');end if;
  if old.driver_id is distinct from new.driver_id or new.status in ('cancelled','delivered') then
   for staff in select id from users where role='admin' and account_status='active' and (admin_access->>'owner'='true' or admin_access->'scopes'?'operations') loop
    perform godrop_private.notice(staff.id,'Delivery updated','Assignment or completion state has changed.','/dashboard/admin/orders/'||new.id,new.id,'order',cycle||':'||staff.id);
   end loop;
  end if;
  if new.status='requested' and new.driver_id is null and new.recovery_case->>'status' is distinct from 'open' then perform godrop_private.announce_paid_delivery(new.id,cycle,old.driver_id);end if;
  if new.status in ('delivered','cancelled') or old.driver_id is distinct from new.driver_id then delete from driver_locations where delivery_id=new.id;end if;
 end if;return new;
end $function$;

CREATE OR REPLACE FUNCTION public.cancel_with_policy(p_actor uuid, p_id uuid, p_fee numeric, p_reason text, p_fault text DEFAULT 'customer'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare o delivery_requests%rowtype;q jsonb;amount numeric;compensation numeric;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found then raise exception 'order_unavailable';end if;
 q:=cancellation_quote(p_actor,p_id,p_fault);
 if o.status='cancelled' then return coalesce(o.cancellation_outcome,q);end if;
 if o.status='delivered' then raise exception 'order_closed';end if;
 if char_length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'cancellation_reason_required';end if;
 if (q->>'review')::boolean then
  update delivery_requests set recovery_case=coalesce(recovery_case,'{}')||jsonb_build_object('status','open','action','cancellation_review','reason',p_reason,'actor',p_actor,'at',now(),'purchase_review',true,'fault',p_fault) where id=p_id;
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
 recovery_case=case when o.service_type<>'buy_for_me' and o.status in ('collected','picked_up','in_transit') then coalesce(o.recovery_case,'{}')||jsonb_build_object('status','open','action','return_to_pickup','reason','Cancelled after collection. Contact support to arrange a safe return to collection.','actor',p_actor,'at',now()) when o.recovery_case->>'action'='safety_release_review' then o.recovery_case||jsonb_build_object('status','closed','action','cancelled') else o.recovery_case end,
 shopping_hold_settled_at=case when service_type='buy_for_me' then now() else shopping_hold_settled_at end where id=p_id;
 if o.driver_id is not null and compensation>0 then
  insert into driver_earnings(driver_id,recovery_delivery_id,amount,commission_amount,status) values(o.driver_id,p_id,compensation,(q->>'platform')::numeric,'pending') on conflict(recovery_delivery_id) do nothing;
 end if;
 insert into admin_audit_log(actor_id,event,entity,details) values(p_actor,'policy_cancellation',p_id::text,q);
 return q;
end $function$;
