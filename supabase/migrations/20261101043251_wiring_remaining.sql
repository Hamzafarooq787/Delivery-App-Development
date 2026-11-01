-- Remaining wiring 10–18: durable recipient-specific events and recoverable payment attempts.
alter table notifications add column entity_id uuid,add column entity_type text,add column event_key text unique;
revoke insert,update on notifications from anon,authenticated;
grant update(read) on notifications to authenticated;
create or replace function godrop_private.notice(p_user uuid,p_title text,p_body text,p_url text,p_entity uuid,p_kind text,p_key text)
returns void language sql security definer set search_path=public as $$
 insert into notifications(user_id,title,body,action_url,entity_id,entity_type,event_key) select p_user,p_title,p_body,p_url,p_entity,p_kind,p_key where p_user is not null on conflict(event_key) do nothing
$$;
revoke all on function godrop_private.notice(uuid,text,text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function godrop_private.notice(uuid,text,text,text,uuid,text,text) to service_role;

create or replace function public.eligible_delivery_drivers(p_id uuid)
returns uuid[] language sql stable security definer set search_path=public as $$
 select coalesce(array_agg(p.id),'{}'::uuid[]) from driver_profiles p join users u on u.id=p.id join delivery_requests d on d.id=p_id
 where d.status='requested' and d.driver_id is null and exists(select 1 from payments x where x.delivery_id=d.id and x.status='paid')
 and u.role='driver' and u.account_status='active' and p.status='approved' and p.is_online and p.delivery_alerts is distinct from false and p.notifications_enabled is distinct from false and driver_compliance_ready(p.id)
 and not exists(select 1 from delivery_requests a where a.driver_id=p.id and a.status in ('accepted','collected','picked_up','in_transit'))
 and exists(select 1 from driver_vehicles v where v.driver_id=p.id and (d.package_size is null or v.vehicle_type='van' or v.vehicle_type='car' and d.package_size in ('small','medium','large') or v.vehicle_type='motorcycle' and d.package_size in ('small','medium') or v.vehicle_type='bicycle' and d.package_size='small'))
$$;
revoke all on function public.eligible_delivery_drivers(uuid) from public,anon,authenticated;
grant execute on function public.eligible_delivery_drivers(uuid) to service_role;
create or replace function godrop_private.announce_paid_delivery(p_id uuid,p_cycle text,p_exclude uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare driver uuid;o delivery_requests%rowtype;
begin
 select * into o from delivery_requests where id=p_id;
 foreach driver in array eligible_delivery_drivers(p_id) loop
  if driver is distinct from p_exclude then perform godrop_private.notice(driver,'New Job Available','A suitable paid job is available. Open it to review the details.','/dashboard/driver/jobs/available?job='||p_id,p_id,'order','available:'||p_id||':'||p_cycle||':'||driver);end if;
 end loop;
end $$;
revoke all on function godrop_private.announce_paid_delivery(uuid,text,uuid) from public,anon,authenticated;
grant execute on function godrop_private.announce_paid_delivery(uuid,text,uuid) to service_role;
create or replace function public.notify_paid_delivery()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status='paid' and new.purpose='booking' and new.delivery_id is not null and (tg_op='INSERT' or old.status is distinct from new.status or old.delivery_id is distinct from new.delivery_id) then perform godrop_private.announce_paid_delivery(new.delivery_id,'booking');end if;return new;
end $$;
revoke all on function public.notify_paid_delivery() from public,anon,authenticated;
create trigger notify_paid_delivery after insert or update on payments for each row execute function public.notify_paid_delivery();
create or replace function public.notify_delivery_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare staff record;cycle text:=gen_random_uuid()::text;body text;title text;
begin
 if tg_op='INSERT' then
  for staff in select id from users where role='admin' and account_status='active' and (admin_access->>'owner'='true' or admin_access->'scopes'?'operations') loop
   perform godrop_private.notice(staff.id,'New Shipment Request','A new order has been created.','/dashboard/admin/orders/'||new.id,new.id,'order','created:'||new.id||':'||staff.id);
  end loop;
 elsif old.driver_id is distinct from new.driver_id or old.status is distinct from new.status then
  if old.driver_id is distinct from new.driver_id then
   if old.driver_id is not null then perform godrop_private.notice(old.driver_id,'Job assignment changed','This job is no longer assigned to you. Your job list has been updated.','/dashboard/driver/active-jobs',new.id,'order',cycle||':old-driver');end if;
   if new.driver_id is not null then perform godrop_private.notice(new.driver_id,'Job assigned','Open your assigned job to review the route and instructions.','/dashboard/driver/jobs/'||new.id,new.id,'order',cycle||':new-driver');end if;
  end if;
  title:=case new.status when 'requested' then 'Finding a replacement driver' when 'accepted' then 'Driver On the Way' when 'collected' then 'Package Picked Up' when 'picked_up' then 'Package Picked Up' when 'in_transit' then 'In Transit' when 'delivered' then 'Delivered!' when 'cancelled' then 'Order Cancelled' else 'Delivery updated' end;
  perform godrop_private.notice(new.customer_id,title,'Open your order for its latest status.','/dashboard/customer/tracking?id='||new.id,new.id,'order',cycle||':customer');
  if new.status='cancelled' and new.driver_id is not null then perform godrop_private.notice(new.driver_id,'Order Cancelled','This order is cancelled. Open the job for its final state.','/dashboard/driver/jobs/'||new.id,new.id,'order',cycle||':cancel-driver');end if;
  if old.driver_id is distinct from new.driver_id or new.status in ('cancelled','delivered') then
   for staff in select id from users where role='admin' and account_status='active' and (admin_access->>'owner'='true' or admin_access->'scopes'?'operations') loop
    perform godrop_private.notice(staff.id,'Delivery updated','Assignment or completion state has changed.','/dashboard/admin/orders/'||new.id,new.id,'order',cycle||':'||staff.id);
   end loop;
  end if;
  if new.status='requested' and new.driver_id is null then perform godrop_private.announce_paid_delivery(new.id,cycle,old.driver_id);end if;
  if new.status in ('delivered','cancelled') or old.driver_id is distinct from new.driver_id then delete from driver_locations where delivery_id=new.id;end if;
 end if;return new;
end $$;
revoke all on function public.notify_delivery_change() from public,anon,authenticated;
drop trigger if exists on_delivery_change on delivery_requests;
create trigger on_delivery_change after insert or update on delivery_requests for each row execute function public.notify_delivery_change();

-- Infer historical order links only for an unambiguous tracking reference and authorised recipient.
with candidates as (
 select n.id notification_id,min(d.id::text)::uuid order_id,count(*) n
 from notifications n join delivery_requests d on d.tracking_number is not null and position(d.tracking_number in n.body)>0
 where n.action_url is null group by n.id having count(*)=1
)
update notifications n set entity_id=c.order_id,entity_type='order',action_url=case when u.role='admin' and (u.admin_access->>'owner'='true' or u.admin_access->'scopes'?'operations') then '/dashboard/admin/orders/'||d.id when n.user_id=d.customer_id then '/dashboard/customer/tracking?id='||d.id when n.user_id=d.driver_id then '/dashboard/driver/jobs/'||d.id when u.role='driver' and n.title ilike '%job%' then '/dashboard/driver/jobs/available?job='||d.id else null end
from candidates c join delivery_requests d on d.id=c.order_id,users u where n.id=c.notification_id and u.id=n.user_id;

-- Retire historical order notices whose source or present access cannot be verified.
update notifications set entity_type='unavailable_order' where action_url is null and title in ('New Job Available','New Shipment Request','Driver On the Way','Order Cancelled','In Transit','Package Picked Up','Delivered!');

-- Atomic timeline events. Historical missing times are explicitly unknown.
alter table delivery_status_logs add column occurred_at_known boolean not null default true,add column event_source text not null default 'application';
create or replace function public.record_delivery_transition()
returns trigger language plpgsql security definer set search_path=public as $$
declare actor uuid;
begin
 if tg_op='UPDATE' and old.status is not distinct from new.status and old.driver_id is not distinct from new.driver_id then return new;end if;
 actor:=coalesce(nullif(current_setting('app.admin_actor',true),'')::uuid,auth.uid(),new.driver_id,case when tg_op='UPDATE' then old.driver_id end,new.customer_id);
 insert into delivery_status_logs(delivery_id,status,updated_by,event_source) values(new.id,new.status,actor,'automatic');return new;
end $$;
revoke all on function public.record_delivery_transition() from public,anon,authenticated;
create trigger record_delivery_transition after insert or update on delivery_requests for each row execute function public.record_delivery_transition();
create or replace function public.deduplicate_transition_log()
returns trigger language plpgsql set search_path=public as $$
begin
 if new.event_source='application' and exists(select 1 from delivery_status_logs where delivery_id=new.delivery_id and status=new.status and event_source='automatic' and created_at>now() at time zone 'UTC'-interval '5 seconds') then return null;end if;return new;
end $$;
revoke all on function public.deduplicate_transition_log() from public,anon,authenticated;
create trigger deduplicate_transition_log before insert on delivery_status_logs for each row execute function public.deduplicate_transition_log();
revoke insert,update,delete on delivery_status_logs from anon,authenticated;
insert into delivery_status_logs(delivery_id,status,updated_by,occurred_at_known,event_source)
 select d.id,'accepted',d.driver_id,false,'historical_reconstruction' from delivery_requests d where d.driver_id is not null and d.status in ('accepted','collected','picked_up','in_transit','delivered') and not exists(select 1 from delivery_status_logs l where l.delivery_id=d.id and l.status='accepted');
delete from driver_locations l where not exists(select 1 from delivery_requests d where d.id=l.delivery_id and d.driver_id=l.driver_id and d.status in ('accepted','collected','picked_up','in_transit'));

-- Support counters and notices derive from the saved reply, never client claims.
alter table support_tickets add column customer_unread integer not null default 0,add column admin_unread integer not null default 1,add column last_reply_at timestamptz;
revoke update,delete,insert on support_tickets from anon,authenticated;
grant insert(user_id,subject,message,status) on support_tickets to authenticated;
create or replace function public.prepare_support_update()
returns trigger language plpgsql security definer set search_path=public as $$
declare latest jsonb;staff boolean;
begin
 if tg_op='INSERT' then
  if char_length(trim(coalesce(new.subject,''))) not between 1 and 180 or char_length(trim(coalesce(new.message,''))) not between 1 and 4000 or not exists(select 1 from users where id=new.user_id and account_status='active') then raise exception 'invalid_support_request';end if;
  if current_setting('role',true) in ('anon','authenticated') and (new.status<>'open' or new.replies<>'[]'::jsonb or new.customer_unread<>0 or new.admin_unread<>1) then raise exception 'support_metadata_protected';end if;
 elsif jsonb_array_length(new.replies)>jsonb_array_length(old.replies) then
  latest:=new.replies->-1;staff:=latest->>'sender'='Support team';new.last_reply_at:=now();
  if staff then new.customer_unread:=old.customer_unread+1;else new.admin_unread:=old.admin_unread+1;end if;
 end if;return new;
end $$;
revoke all on function public.prepare_support_update() from public,anon,authenticated;
create trigger prepare_support_update before insert or update on support_tickets for each row execute function public.prepare_support_update();
create or replace function public.notify_support_update()
returns trigger language plpgsql security definer set search_path=public as $$
declare staff record;recipient_role text;latest jsonb;key text;is_staff boolean;
begin
 select role into recipient_role from users where id=new.user_id;
 if tg_op='INSERT' then key:='ticket:'||new.id;is_staff:=false;
 elsif jsonb_array_length(new.replies)>jsonb_array_length(old.replies) then latest:=new.replies->-1;key:=latest->>'id';is_staff:=latest->>'sender'='Support team';
 elsif new.status is distinct from old.status then
  perform godrop_private.notice(new.user_id,'Support request updated','Your support request is now '||new.status||'.','/dashboard/'||case when recipient_role='driver' then 'driver' else 'customer' end||'/support?ticket='||new.id,new.id,'support',gen_random_uuid()::text);return new;
 else return new;end if;
 if is_staff then
  perform godrop_private.notice(new.user_id,'Support Reply','A reply is waiting in your support request.','/dashboard/'||case when recipient_role='driver' then 'driver' else 'customer' end||'/support?ticket='||new.id,new.id,'support','support:'||new.id||':'||key||':recipient');
 else
  for staff in select id from users where role='admin' and account_status='active' and (admin_access->>'owner'='true' or admin_access->'scopes'?'support') loop
   perform godrop_private.notice(staff.id,'Support request update','A customer or driver needs a support response.','/dashboard/admin/support?ticket='||new.id,new.id,'support','support:'||new.id||':'||key||':'||staff.id);
  end loop;
 end if;return new;
end $$;
revoke all on function public.notify_support_update() from public,anon,authenticated;
create trigger notify_support_update after insert or update on support_tickets for each row execute function public.notify_support_update();
create or replace function public.mark_support_read(p_actor uuid,p_id uuid,p_seen integer)
returns void language plpgsql security definer set search_path=public as $$
declare t support_tickets%rowtype;staff boolean;remaining integer;
begin
 select * into t from support_tickets where id=p_id for update;
 staff:=godrop_private.admin_has_scope(p_actor,'support');
 if not found or p_actor is null or not (staff or t.user_id=p_actor) or p_seen<0 or p_seen>jsonb_array_length(t.replies) then raise exception 'support_unavailable';end if;
 select count(*) into remaining from jsonb_array_elements(t.replies) with ordinality m where ordinality>p_seen and ((staff and m.value->>'sender'<>'Support team') or (not staff and m.value->>'sender'='Support team'));
 if staff then update support_tickets set admin_unread=remaining where id=p_id and admin_unread is distinct from remaining;else update support_tickets set customer_unread=remaining where id=p_id and customer_unread is distinct from remaining;end if;
end $$;
revoke all on function public.mark_support_read(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.mark_support_read(uuid,uuid,integer) to service_role;
create or replace function public.send_support_message(p_actor uuid,p_id uuid,p_key uuid,p_body text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t support_tickets%rowtype;previous jsonb;
begin
 select * into t from support_tickets where id=p_id for update;
 if not found then raise exception 'support_unavailable';end if;
 select value into previous from jsonb_array_elements(t.replies) where value->>'id'=p_key::text;
 perform append_customer_thread('support',p_id,p_actor,p_key,p_body);
 if previous is not null and (previous->>'sender_id' is distinct from p_actor::text or previous->>'body' is distinct from trim(p_body)) then raise exception 'message_reference_changed';end if;
 return jsonb_build_object('created',previous is null);
end $$;
revoke all on function public.send_support_message(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.send_support_message(uuid,uuid,uuid,text) to service_role;

-- A checkout's creation clock and provider idempotency key are per attempt.
alter table payments add column checkout_attempt integer not null default 0,add column checkout_started_at timestamptz,add column checkout_history jsonb not null default '[]';
revoke insert(checkout_attempt,checkout_started_at,checkout_history),update(checkout_attempt,checkout_started_at,checkout_history) on payments from public,anon,authenticated;
create or replace function public.restart_waiting_checkout(p_actor uuid,p_payment uuid,p_session text,p_attempt integer,p_verified_missing boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype;p payments%rowtype;
begin
 select d.* into o from delivery_requests d join payments x on x.related_delivery_id=d.id where x.id=p_payment for update of d;
 select * into p from payments where id=p_payment for update;
 if not found or p.customer_id is distinct from p_actor or p.purpose<>'collection_wait' or o.status not in ('accepted','collected','picked_up','in_transit','delivered') or o.collection_wait->>'payment_id' is distinct from p.id::text then raise exception 'waiting_restart_unavailable';end if;
 if p.checkout_attempt>p_attempt then return to_jsonb(p);end if;
 if p.checkout_attempt<>p_attempt or p.status not in ('pending','failed') or p.stripe_payment_intent is not null or p.stripe_session_id is distinct from p_session or (p_session is null and not p_verified_missing) then raise exception 'verified_expired_checkout_required';end if;
 update payments set status='pending',checkout_attempt=checkout_attempt+1,checkout_started_at=now(),checkout_history=checkout_history||jsonb_build_array(jsonb_build_object('session',p_session,'attempt',p_attempt,'verified_expired_at',now())),stripe_session_id=null where id=p.id returning * into p;
 return to_jsonb(p);
end $$;
revoke all on function public.restart_waiting_checkout(uuid,uuid,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.restart_waiting_checkout(uuid,uuid,text,integer,boolean) to service_role;
create or replace function public.bind_waiting_checkout(p_actor uuid,p_payment uuid,p_attempt integer,p_session text)
returns void language plpgsql security definer set search_path=public as $$
begin
 update payments set stripe_session_id=p_session,checkout_started_at=coalesce(checkout_started_at,now()) where id=p_payment and customer_id=p_actor and purpose='collection_wait' and status='pending' and checkout_attempt=p_attempt and (stripe_session_id is null or stripe_session_id=p_session);
 if not found then raise exception 'checkout_attempt_changed';end if;
end $$;
revoke all on function public.bind_waiting_checkout(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.bind_waiting_checkout(uuid,uuid,integer,text) to service_role;
create or replace function public.queue_waiting_refund(p_actor uuid,p_payment uuid,p_amount numeric,p_reason text,p_key uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare p payments%rowtype;total numeric;prior jsonb;
begin
 if not godrop_private.admin_has_scope(p_actor,'finance') or length(trim(coalesce(p_reason,''))) not between 3 and 500 or p_key is null then raise exception 'finance_refund_required';end if;
 select * into p from payments where id=p_payment for update;
 if not found or p.status<>'paid' or p.payment_method<>'stripe' or p.purpose<>'collection_wait' or p.related_delivery_id is null then raise exception 'paid_waiting_payment_required';end if;
 select value into prior from jsonb_array_elements(p.refund_jobs) where value->>'key'='admin:'||p_key;
 if prior is not null then if (prior->>'amount')::numeric is distinct from p_amount or prior->>'reason' is distinct from p_reason then raise exception 'refund_reference_changed';end if;return p.related_delivery_id;end if;
 select coalesce(sum((value->>'amount')::numeric),0) into total from jsonb_array_elements(p.refund_jobs) where value->>'state' not in ('failed','canceled');
 if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or round(p_amount,2)<>p_amount or total+p_amount>p.amount then raise exception 'invalid_refund_amount';end if;
 update payments set refund_jobs=refund_jobs||jsonb_build_array(jsonb_build_object('key','admin:'||p_key,'amount',p_amount,'state','pending','actor',p_actor,'reason',p_reason)) where id=p.id;
 perform append_admin_audit(p_actor,'waiting_refund_queued',p.id::text,jsonb_build_object('order',p.related_delivery_id,'amount',p_amount,'reason',p_reason));
 return p.related_delivery_id;
end $$;
revoke all on function public.queue_waiting_refund(uuid,uuid,numeric,text,uuid) from public,anon,authenticated;
grant execute on function public.queue_waiting_refund(uuid,uuid,numeric,text,uuid) to service_role;
CREATE OR REPLACE FUNCTION public.reserve_waiting_checkout(p_actor uuid, p_id uuid, p_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o delivery_requests%rowtype;p payments%rowtype;config jsonb;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found or o.customer_id is distinct from p_actor or o.service_type<>'delivery' or o.status='cancelled' then raise exception 'not_allowed';end if;
 if o.collection_wait->>'payment_id' is not null then select * into p from payments where id=(o.collection_wait->>'payment_id')::uuid;return to_jsonb(p);end if;
 if o.status not in ('accepted','collected','picked_up','in_transit','delivered') or o.collection_wait->>'status'<>'approved_for_review' or coalesce((o.collection_wait->>'amount')::numeric,0)<=0 then raise exception 'approved_wait_required';end if;
 select booking_pricing into config from surge_pricing_settings where id=true;
 insert into payments(customer_id,request_key,related_delivery_id,purpose,amount,status,payment_method,booking_draft) values(p_actor,p_key,p_id,'collection_wait',(o.collection_wait->>'amount')::numeric,'pending','stripe',jsonb_build_object('type','collection_wait','driver_id',coalesce(nullif(o.collection_wait->>'driver_id','')::uuid,o.driver_id),'commission_percent',coalesce((config->>'commissionPercent')::numeric,20),'wait',o.collection_wait)) returning * into p;
 update payments set checkout_started_at=now() where id=p.id returning * into p;
 update delivery_requests set collection_wait=collection_wait||jsonb_build_object('payment_id',p.id) where id=p_id;
 return to_jsonb(p);
end $function$
;
revoke all on function public.reserve_waiting_checkout(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_waiting_checkout(uuid,uuid,uuid) to service_role;
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
 union all select coalesce(p.delivery_id,p.related_delivery_id),'Card refund needs attention',p.created_at,'order' from payments p where coalesce(p.delivery_id,p.related_delivery_id) is not null and exists(select 1 from jsonb_array_elements(p.refund_jobs) r where r->>'state' in ('failed','requires_action'))

 union all select d.id,'Driver location missing or over 45 seconds old',d.created_at,'order' from delivery_requests d left join driver_locations l on l.driver_id=d.driver_id and l.delivery_id=d.id where d.status in ('accepted','collected','picked_up','in_transit') and (l.updated_at is null or l.updated_at<now()-interval '45 seconds')
 union all select d.id,'Shopping receipt missing',d.created_at,'order' from delivery_requests d where d.service_type='buy_for_me' and d.bfm_stage in ('purchase_completed','heading_to_customer','delivered') and d.receipt_url is null and d.status<>'cancelled'
 union all select p.id,'Bank payout needs reconciliation',p.created_at,'payout' from payouts p where p.provider->>'error' is not null or p.provider->>'state' in ('failed','canceled') or (p.provider is null and p.admin_note='historical_payouts_require_reconciliation')
 union all select coalesce(p.delivery_id,p.related_delivery_id,p.id),'Card payment failed',p.created_at,case when coalesce(p.delivery_id,p.related_delivery_id) is null then 'payment' else 'order' end from payments p where p.status='failed'

 union all select d.id,'Shopping order needs a funded company purchase card',d.created_at,'order' from delivery_requests d where d.service_type='buy_for_me' and d.status in ('requested','accepted','collected') and d.company_card_verified_at is null and exists(select 1 from payments p where p.delivery_id=d.id and p.status='paid')
 union all select d.id,'Waiting request awaiting customer approval or payment',d.created_at,'order' from delivery_requests d where d.collection_wait->>'status' in ('awaiting_customer','approved_for_review') and d.status not in ('cancelled','delivered')
 union all select d.id,'Completed order has no confirmed payment — reconcile',d.created_at,'order' from delivery_requests d where d.status='delivered' and not exists(select 1 from payments p where p.delivery_id=d.id and p.status='paid')
 union all select d.id,'Completed order has no earnings record — reconcile',d.created_at,'order' from delivery_requests d where d.status='delivered' and d.driver_id is not null and not exists(select 1 from driver_earnings e where e.delivery_id=d.id)
 union all select p.id,'Checkout has remained pending for over 30 minutes',p.created_at,'payment' from payments p where p.status='pending' and p.created_at<now() at time zone 'UTC'-interval '30 minutes'
 union all select d.id,'Open recovery case',d.created_at,'order' from delivery_requests d where d.recovery_case->>'status'='open'
 ) q order by at,id limit 100) x;
 return result;
end $function$
;
revoke all on function public.admin_attention_queue(uuid) from public,anon,authenticated;
grant execute on function public.admin_attention_queue(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.driver_collection_wait(p_id uuid, p_actor uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o delivery_requests%rowtype; state jsonb; rate numeric; elapsed numeric;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found or o.service_type<>'delivery' or o.status<>'accepted' then raise exception 'collection_wait_unavailable'; end if;
 state:=o.collection_wait;
 if p_action='start' and o.driver_id=p_actor then
  if state is not null then return state; end if;
  state:=jsonb_build_object('driver_id',o.driver_id,'started_at',now(),'status','timing','free_minutes',5);
 elsif p_action='request' and o.driver_id=p_actor then
  if state->>'status'<>'timing' or state is null or (state->>'driver_id' is not null and state->>'driver_id'<>p_actor::text) then raise exception 'start_wait_first'; end if;
  select coalesce((booking_pricing->>'waitingPerMinute')::numeric,0) into rate from surge_pricing_settings limit 1;
  elapsed:=least(3600,greatest(0,extract(epoch from now()-(state->>'started_at')::timestamptz)-300));
  if rate<=0 or rate>10 or elapsed<=0 then raise exception 'no_charge_configured_or_free_wait'; end if;
  state:=state||jsonb_build_object('status','awaiting_customer','rate',rate,'seconds',elapsed,'amount',round(elapsed/60*rate,2),'requested_at',now());
  insert into notifications(user_id,title,body,action_url) values(o.customer_id,'Collection waiting request','Review the waiting amount before agreeing. No payment has been taken.','/dashboard/customer/tracking?id='||p_id);
 elsif p_action in ('approve','decline') and o.customer_id=p_actor and state->>'status'='awaiting_customer' then
  state:=state||jsonb_build_object('status',case when p_action='approve' then 'approved_for_review' else 'declined' end,'responded_at',now());
  insert into notifications(user_id,title,body,action_url) select id,'Waiting request reviewed','The customer reviewed a collection waiting request. No automatic payment has been taken.','/dashboard/admin/orders/'||p_id from users where role='admin';
 else raise exception 'wait_action_not_allowed'; end if;
 update delivery_requests set collection_wait=state where id=p_id;
 return state;
end $function$
;
revoke all on function public.driver_collection_wait(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.driver_collection_wait(uuid,uuid,text) to service_role;

create or replace function public.guard_driver_claim_compliance()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.driver_id is not null and (old.driver_id is distinct from new.driver_id or old.status='requested' and new.status='accepted') and not driver_compliance_ready(new.driver_id) then raise exception 'driver_documents_incomplete';end if;return new;
end $$;
revoke all on function public.guard_driver_claim_compliance() from public,anon,authenticated;
create trigger guard_driver_claim_compliance before update on delivery_requests for each row execute function public.guard_driver_claim_compliance();

-- A replacement driver must not inherit an unapproved timer from the former driver.
alter table delivery_requests add column collection_wait_history jsonb not null default '[]';
revoke insert(collection_wait_history),update(collection_wait_history) on delivery_requests from public,anon,authenticated;
create or replace function public.detach_unapproved_wait_on_assignment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.driver_id is distinct from new.driver_id and old.collection_wait is not null then
  if old.collection_wait->>'status' in ('timing','awaiting_customer','declined') and old.collection_wait->>'payment_id' is null then
   new.collection_wait_history:=old.collection_wait_history||jsonb_build_array(old.collection_wait||jsonb_build_object('driver_id',old.driver_id,'closed_on_reassignment_at',now()));new.collection_wait:=null;
  elsif new.collection_wait->>'driver_id' is null then new.collection_wait:=new.collection_wait||jsonb_build_object('driver_id',old.driver_id);end if;
 end if;return new;
end $$;
revoke all on function public.detach_unapproved_wait_on_assignment() from public,anon,authenticated;
create trigger detach_unapproved_wait_on_assignment before update of driver_id on delivery_requests for each row execute function public.detach_unapproved_wait_on_assignment();

create or replace function public.accrue_waiting_earnings(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype;p payments%rowtype;amount numeric;earning_driver uuid;reserved_refunds numeric;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found then return;end if;
 for p in select * from payments where related_delivery_id=p_id and purpose='collection_wait' and status='paid' for update loop
  if o.status='cancelled' then
   select coalesce(sum((j->>'amount')::numeric),0) into reserved_refunds from jsonb_array_elements(p.refund_jobs) j where j->>'state' not in ('failed','canceled');
   if reserved_refunds<p.amount and not exists(select 1 from jsonb_array_elements(p.refund_jobs) j where j->>'key'='cancel-wait') then update payments set refund_jobs=refund_jobs||jsonb_build_array(jsonb_build_object('key','cancel-wait','amount',p.amount-reserved_refunds,'state','pending')) where id=p.id;end if;
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
  sender:=case when staff then 'Support team' when (select role from users where id=p_actor)='driver' then 'Driver' else 'Customer' end;
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
revoke all on function public.append_customer_thread(text,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.append_customer_thread(text,uuid,uuid,uuid,text) to service_role;
