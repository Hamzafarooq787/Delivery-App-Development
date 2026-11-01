-- Wiring repairs 1–9. Browser roles never execute actor-parameter write RPCs.
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
end $function$
;
CREATE OR REPLACE FUNCTION public.can_read_order_photo(p_user uuid, p_url text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select (godrop_private.admin_has_scope(p_user,'operations') or godrop_private.admin_has_scope(p_user,'support')) or exists(
  select 1 from delivery_requests d where (d.customer_id=p_user or d.driver_id=p_user) and (
   (position('/public/delivery-item-photos/'||d.customer_id::text||'/' in p_url)>0 and
    (p_url=any(coalesce(d.item_photo_urls,'{}'::text[])) or exists(select 1 from shopping_items i where i.delivery_id=d.id and i.photo_url=p_url)))
   or (position('/public/delivery-item-photos/'||d.driver_id::text||'/' in p_url)>0 and
    (d.receipt_url=p_url or exists(select 1 from shopping_substitutions s where s.delivery_id=d.id and s.photo_url=p_url)))
  )
 );
$function$
;
CREATE OR REPLACE FUNCTION public.customer_payment_records(p_customer uuid, p_page integer DEFAULT 1, p_size integer DEFAULT 10, p_refunds boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 with records as (
 select p.id,coalesce(p.delivery_id,p.related_delivery_id) delivery_id,p.status,p.created_at,p.payment_method,
 case when p.payment_method='wallet' then coalesce((select jsonb_agg(jsonb_build_object('key',w.id,'amount',w.amount,'state','succeeded')) from public.wallet_transactions w where w.delivery_id=d.id and w.user_id=p_customer and w.type='cashback' and w.amount>0),'[]'::jsonb) else coalesce(p.refund_jobs,'[]'::jsonb) end refund_jobs,
 d.tracking_number tracking,case when p.purpose='collection_wait' then 'Collection waiting' when d.service_type='buy_for_me' then 'Buy for Me' else 'Collect & Deliver' end service,
 case when p.payment_method='wallet' and d.service_type='buy_for_me' then d.price+coalesce(d.max_spend_approved,0) else p.amount end amount,
 case when p.purpose='booking' and d.service_type='buy_for_me' then coalesce(d.max_spend_approved,0) else 0 end "shoppingFunds",case when p.purpose='collection_wait' then p.amount else d.price end "serviceFees",
 case when d.shopping_hold_settled_at is not null then d.actual_items_total end "actualShopping",
 case when d.shopping_hold_settled_at is not null then greatest(0,coalesce(d.max_spend_approved,0)-d.actual_items_total) end "unusedShopping"
 from public.payments p join public.delivery_requests d on d.id=coalesce(p.delivery_id,p.related_delivery_id)
 where d.customer_id=p_customer
 ), calculated as (
 select r.*,case when jsonb_array_length(refund_jobs)>0 then coalesce((select sum((j->>'amount')::numeric) from jsonb_array_elements(refund_jobs) j where j->>'state'='succeeded'),0)
 when status='refunded' then amount else 0 end returned from records r
 ), filtered as (select * from calculated where not p_refunds or jsonb_array_length(refund_jobs)>0 or status in ('refunded','partially_refunded')),
 page as (select *,greatest(0,amount-returned) "retainedTotal" from filtered order by created_at desc nulls last,id desc limit greatest(1,least(coalesce(p_size,10),50)) offset (greatest(1,coalesce(p_page,1))-1)*greatest(1,least(coalesce(p_size,10),50)))
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page)||jsonb_build_object('payment_status',status,'status',case when returned>0 and round(returned*100)>=round(amount*100) then 'refunded' when returned>0 then 'partially_refunded' when exists(select 1 from jsonb_array_elements(refund_jobs) j where j->>'state' in ('pending','requires_action')) then 'refund_pending' else status end)) from page),'[]'::jsonb),'totalCount',(select count(*) from filtered),
 'paidMonth',(select coalesce(sum(amount),0) from calculated where status in ('paid','released','refunded','partially_refunded') and created_at >= (date_trunc('month',now() at time zone 'Europe/London') at time zone 'Europe/London')),
 'refunds',(select coalesce(sum(returned),0) from calculated));
$function$
;
create or replace function public.accrue_waiting_earnings(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype;p payments%rowtype;amount numeric;earning_driver uuid;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found then return;end if;
 for p in select * from payments where related_delivery_id=p_id and purpose='collection_wait' and status='paid' for update loop
  if o.status='cancelled' then
   if not exists(select 1 from jsonb_array_elements(p.refund_jobs) j where j->>'key'='cancel-wait') then update payments set refund_jobs=refund_jobs||jsonb_build_array(jsonb_build_object('key','cancel-wait','amount',p.amount,'state','pending')) where id=p.id;end if;
  elsif o.status='delivered' and o.driver_id is not null then
   earning_driver:=nullif(p.booking_draft->>'driver_id','')::uuid;
   if earning_driver is null then raise exception 'waiting_driver_evidence_missing';end if;
   amount:=round(p.amount*(1-coalesce((p.booking_draft->>'commission_percent')::numeric,20)/100),2);
   insert into driver_earnings(driver_id,delivery_id,source_payment_id,amount,commission_amount,status) values(earning_driver,null,p.id,amount,p.amount-amount,'pending') on conflict(source_payment_id) do nothing;
  end if;
 end loop;
end $$;
revoke all on function public.accrue_waiting_earnings(uuid) from public,anon,authenticated;
grant execute on function public.accrue_waiting_earnings(uuid) to service_role;

-- Recovery records contain private notes. Participants receive only fixed public instructions.
create or replace function public.acknowledge_order_recovery(p_actor uuid,p_id uuid,p_version text)
returns void language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found or o.driver_id is distinct from p_actor or o.recovery_case->>'status' is distinct from 'open' or o.recovery_case->>'at' is distinct from p_version then raise exception 'recovery_changed';end if;
 if o.recovery_case->>'driver_acknowledged_at' is not null then return;end if;
 update delivery_requests set recovery_case=recovery_case||jsonb_build_object('driver_acknowledged_at',now(),'driver_acknowledged_by',p_actor) where id=p_id;
 insert into admin_audit_log(actor_id,event,entity,details) values(p_actor,'recovery_acknowledged',p_id::text,jsonb_build_object('case_version',p_version));
end $$;
revoke all on function public.acknowledge_order_recovery(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.acknowledge_order_recovery(uuid,uuid,text) to service_role;

create or replace function public.guard_recovery_progress()
returns trigger language plpgsql set search_path=public as $$
begin
 if new.status='delivered' and old.status<>'delivered' and not exists(select 1 from payments where delivery_id=new.id and status='paid') then raise exception 'confirmed_payment_required';end if;
 if new.status in ('collected','picked_up','in_transit','delivered') and (new.status is distinct from old.status or new.bfm_stage is distinct from old.bfm_stage or new.purchase_authorized_at is distinct from old.purchase_authorized_at) then
  if new.recovery_case->>'status'='open' and new.recovery_case->>'action' in ('return_to_pickup','verification_hold') then raise exception 'recovery_instructions_required';end if;
  if not exists(select 1 from driver_profiles where id=new.driver_id and status='approved') then raise exception 'driver_clearance_required';end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_recovery_progress() from public,anon,authenticated;
create trigger guard_recovery_progress before update on public.delivery_requests for each row execute function public.guard_recovery_progress();

create or replace function public.handle_driver_clearance_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype;actor uuid;prior jsonb;
begin
 if new.status is not distinct from old.status or new.status='approved' then return new;end if;
 actor:=nullif(current_setting('app.admin_actor',true),'')::uuid;
 for o in select * from delivery_requests where driver_id=new.id and status in ('accepted','collected','picked_up','in_transit') for update loop
  prior:=o.recovery_case;
  update delivery_requests set recovery_case=coalesce(prior,'{}')||jsonb_build_object('status','open','action',case when prior->>'action'='return_to_pickup' and prior->>'status'='open' then 'return_to_pickup' else 'verification_hold' end,'reason','Driver clearance changed. Confirm safe handover or return before continuing.','actor',actor,'at',now(),'driver_acknowledged_at',null,'driver_acknowledged_by',null) where id=o.id;
  insert into notifications(user_id,title,body,action_url) values(o.customer_id,'Delivery support review','Support is arranging a safe outcome for your delivery.','/dashboard/customer/tracking?id='||o.id),(new.id,'Delivery paused for support','Do not continue this delivery. Open the job for support instructions.','/dashboard/driver/jobs/'||o.id);
  insert into notifications(user_id,title,body,action_url) select id,'Driver handover required','An assigned driver needs clearance review. Arrange a safe handover or return.','/dashboard/admin/orders/'||o.id from users where role='admin' and (admin_access->>'owner'='true' or admin_access->'scopes'?'operations');
  insert into admin_audit_log(actor_id,event,entity,details) values(actor,'driver_clearance_handover',o.id::text,jsonb_build_object('driver',new.id));
 end loop;
 return new;
end $$;
-- Trigger may also run for a system clearance change, so record actor directly.
revoke all on function public.handle_driver_clearance_change() from public,anon,authenticated;
create trigger driver_clearance_handover after update of status on public.driver_profiles for each row execute function public.handle_driver_clearance_change();
create or replace function public.admin_recovery_case(p_actor uuid,p_id uuid,p_action text,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype;
begin
 if not godrop_private.admin_has_scope(p_actor,'operations') then raise exception 'admin_required';end if;
 if p_action not in ('open','return_to_pickup','close') or length(trim(coalesce(p_reason,'')))<5 then raise exception 'recovery_reason_required';end if;
 select * into o from delivery_requests where id=p_id for update;
 if not found then raise exception 'order_missing';end if;
 perform set_config('app.admin_actor',p_actor::text,true);
 update delivery_requests set recovery_case=coalesce(recovery_case,'{}')||jsonb_build_object('status',case when p_action='close' then 'closed' else 'open' end,'action',p_action,'reason',left(p_reason,1000),'actor',p_actor,'at',now(),'driver_acknowledged_at',null,'driver_acknowledged_by',null) where id=p_id;
 insert into notifications(user_id,title,body,action_url) select o.customer_id,'Delivery support update','Open your delivery for the latest support instructions.','/dashboard/customer/tracking?id='||p_id where o.customer_id is not null;
 insert into notifications(user_id,title,body,action_url) select o.driver_id,'Delivery support update','Open your job and acknowledge the support instructions.','/dashboard/driver/jobs/'||p_id where o.driver_id is not null;
 perform append_admin_audit(p_actor,'order_recovery_'||p_action,p_id::text,jsonb_build_object('reason',p_reason));
end $$;
revoke all on function public.admin_recovery_case(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_recovery_case(uuid,uuid,text,text) to service_role;


-- Reconstruct historical wallet records from existing ledger evidence only.
-- This never debits a wallet, charges a card, sends a bank payout or edits an existing earning.
create or replace function public.reconcile_legacy_wallet_order(p_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype;w wallet_transactions%rowtype;p payments%rowtype;n integer;earning numeric;payment_added boolean:=false;earning_added boolean:=false;
begin
 if p_actor is not null and not godrop_private.admin_has_scope(p_actor,'finance') then raise exception 'finance_permission_required';end if;
 select * into o from delivery_requests where id=p_id for update;
 if not found or o.status<>'delivered' or o.payment_method<>'wallet' or o.service_type<>'delivery' then raise exception 'legacy_wallet_order_required';end if;
 select * into p from payments where delivery_id=p_id for update;
 if p.id is null then
  select count(*) into n from wallet_transactions where delivery_id=p_id and user_id=o.customer_id and type='deduction' and abs(amount)=o.price and description not ilike '%shopping funds hold%';
  if n<>1 or exists(select 1 from wallet_transactions where delivery_id=p_id and type='cashback') then raise exception 'unambiguous_wallet_evidence_required';end if;
  select * into w from wallet_transactions where delivery_id=p_id and user_id=o.customer_id and type='deduction' and abs(amount)=o.price and description not ilike '%shopping funds hold%';
  insert into payments(customer_id,delivery_id,amount,status,payment_method,created_at,paid_at,booking_draft) values(o.customer_id,o.id,o.price,'paid','wallet',w.created_at,w.created_at at time zone 'UTC',jsonb_build_object('reconciled_from_wallet_transaction',w.id,'reconciled_at',now())) returning * into p;
  payment_added:=true;
 elsif (p.customer_id is not null and p.customer_id is distinct from o.customer_id) or p.status<>'paid' or p.amount is distinct from o.price or p.payment_method<>'wallet' then raise exception 'payment_evidence_conflict';end if;
 if not exists(select 1 from driver_earnings where delivery_id=p_id) then
  if o.driver_id is null or exists(select 1 from payouts where driver_id=o.driver_id) then raise exception 'historical_payout_review_required';end if;
  earning:=coalesce(o.driver_earning_quote,round(o.price*.75,2));
  insert into driver_earnings(driver_id,delivery_id,amount,commission_amount,status,created_at) values(o.driver_id,o.id,earning,o.price-earning,'pending',coalesce(o.delivered_at at time zone 'UTC',o.created_at)) on conflict(delivery_id) do nothing;
  earning_added:=found;
 end if;
 if payment_added or earning_added then insert into admin_audit_log(actor_id,event,entity,details) values(p_actor,'legacy_wallet_order_reconciled',p_id::text,jsonb_build_object('payment_added',payment_added,'earning_added',earning_added,'payment_id',p.id,'wallet_transaction',w.id,'rate_basis',case when o.driver_earning_quote is null then 'existing_legacy_75_percent_rule' else 'stored_driver_quote' end));end if;
 return jsonb_build_object('payment_added',payment_added,'earning_added',earning_added);
end $$;
revoke all on function public.reconcile_legacy_wallet_order(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reconcile_legacy_wallet_order(uuid,uuid) to service_role;

-- Repair audited missing historical wallet records, subject to the evidence checks above.
-- Missing/changed evidence raises an exception and rolls back the whole migration.
do $$ declare candidate uuid;begin
 for candidate in select id from delivery_requests where status='delivered' and payment_method='wallet' and service_type='delivery' and (not exists(select 1 from payments p where p.delivery_id=delivery_requests.id and p.status='paid') or not exists(select 1 from driver_earnings e where e.delivery_id=delivery_requests.id)) loop perform reconcile_legacy_wallet_order(candidate,null);end loop;
end $$;
-- Restore operational access for approved active drivers stranded in customer mode.
-- Preserve customer profile/history and every physical assignment.
do $$ declare u record;o record;begin
 for u in select users.id from users join driver_profiles p on p.id=users.id where users.role='customer' and users.account_status='active' and p.status='approved' and exists(select 1 from delivery_requests d where d.driver_id=users.id and d.status in ('accepted','collected','picked_up','in_transit')) for update of users loop
  update users set role='driver' where id=u.id;
  insert into admin_audit_log(event,entity,details) values('legacy_driver_mode_restored',u.id::text,'{"source":"audited_existing_active_assignments","previous_role":"customer"}');
 end loop;
 for o in select d.* from delivery_requests d where d.status in ('accepted','collected','picked_up','in_transit') and (select count(*) from delivery_requests x where x.driver_id=d.driver_id and x.status in ('accepted','collected','picked_up','in_transit'))>1 for update loop
  if o.recovery_case is null then update delivery_requests set recovery_case=jsonb_build_object('status','open','action','legacy_assignment_review','reason','Multiple historical active assignments: confirm the physical pickup and delivery state before releasing or reassigning.','at',now()) where id=o.id;end if;
 end loop;
end $$;

revoke all on function public.append_customer_thread(text,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.append_customer_thread(text,uuid,uuid,uuid,text) to service_role;

revoke all on function public.can_read_order_photo(uuid,text) from public,anon,authenticated;
grant execute on function public.can_read_order_photo(uuid,text) to service_role;

revoke all on function public.customer_payment_records(uuid,integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.customer_payment_records(uuid,integer,integer,boolean) to service_role;
