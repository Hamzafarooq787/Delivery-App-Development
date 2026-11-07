-- Only dispatch may return a paid, uncollected job to the pool. No payment
-- writes, cancellation fees or refund requests belong in this action.
create or replace function public.admin_recovery_case(p_actor uuid,p_id uuid,p_action text,p_reason text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare o delivery_requests%rowtype; next_status text; next_action text; release_job boolean;
begin
 if not godrop_private.admin_has_scope(p_actor,'operations') then raise exception 'admin_required';end if;
 if p_action is null or p_action not in ('open','return_to_pickup','close','resume','release_to_drivers') or length(trim(coalesce(p_reason,'')))<5 then raise exception 'recovery_reason_required';end if;
 select * into o from delivery_requests where id=p_id for update;
 if not found then raise exception 'order_missing';end if;
 if o.recovery_case->>'status'='open' and o.recovery_case->>'action'='cancellation_review' then raise exception 'cancellation_review_requires_finance';end if;

 release_job:=p_action='release_to_drivers' or
   (p_action='close' and o.driver_id is null and o.status='requested');
 if release_job then
   if o.status not in ('requested','accepted') or o.company_card_reference is not null
     or o.purchase_authorized_at is not null or o.purchase_confirmed_at is not null or o.receipt_url is not null
     or coalesce(o.bfm_stage,'') not in ('','heading_to_shop','arrived_at_shop')
     or o.parcel_image_url is not null
     or not exists(select 1 from payments where delivery_id=p_id and purpose='booking' and status='paid')
     or (coalesce(o.recovery_case->>'status','')<>'open' and not (o.driver_id is not null and coalesce(o.recovery_case->>'action','') in ('close','resume')))
   then raise exception 'release_requires_paid_uncollected_order';end if;
   next_status:='closed'; next_action:='release_to_drivers';
 elsif p_action in ('resume','close') then
   if coalesce(o.recovery_case->>'status','')<>'open' then raise exception 'recovery_case_not_open';end if;
   if p_action='resume' or (o.driver_id is not null and o.status in ('accepted','collected','picked_up','in_transit')) then
     if o.driver_id is null or o.status not in ('accepted','collected','picked_up','in_transit')
       or not exists(select 1 from driver_profiles p join users u on u.id=p.id where p.id=o.driver_id and p.status='approved' and u.role='driver' and u.account_status='active')
     then raise exception 'resume_requires_approved_assigned_driver';end if;
     next_action:='resume';
   else next_action:='close';end if;
   next_status:='closed';
 else
   if o.status in ('cancelled','delivered') or
     (p_action='return_to_pickup' and (o.driver_id is null or o.status not in ('accepted','collected','picked_up','in_transit')))
     or (coalesce(o.recovery_case->>'status','')='open' and o.recovery_case->>'action'='safety_release_review')
   then raise exception 'recovery_action_not_available';end if;
   next_status:='open'; next_action:=p_action;
 end if;

 perform set_config('app.admin_actor',p_actor::text,true);
 if release_job then
   update delivery_requests set driver_id=null,status='requested',
     recovery_case=coalesce(recovery_case,'{}')||jsonb_build_object('status',next_status,'action',next_action,'reason',left(p_reason,1000),'actor',p_actor,'at',now(),'driver_acknowledged_at',null,'driver_acknowledged_by',null,'customer_fee',0)
   where id=p_id;
   -- The existing status/assignment trigger covers changed assignments and a
   -- closed safety release. Announce other already-unassigned cases here.
   if o.status='requested' and o.driver_id is null and o.recovery_case->>'action' is distinct from 'safety_release_review' then
     perform godrop_private.announce_paid_delivery(p_id,gen_random_uuid()::text);
   end if;
 else
   update delivery_requests set recovery_case=coalesce(recovery_case,'{}')||jsonb_build_object('status',next_status,'action',next_action,'reason',left(p_reason,1000),'actor',p_actor,'at',now(),'driver_acknowledged_at',null,'driver_acknowledged_by',null) where id=p_id;
 end if;
 if not release_job then
   insert into notifications(user_id,title,body,action_url)
     select o.customer_id,'Delivery support update',case when next_action='resume' then 'Support has cleared the assigned driver to continue.' else 'Open your delivery for the latest support instructions.' end,'/dashboard/customer/tracking?id='||p_id where o.customer_id is not null;
   insert into notifications(user_id,title,body,action_url)
     select o.driver_id,case when next_action='resume' then 'Job resumed' else 'Delivery support update' end,case when next_action='resume' then 'Open the job to continue from your last step.' else 'Open your job for the latest support instructions.' end,'/dashboard/driver/jobs/'||p_id where o.driver_id is not null;
 end if;
 perform append_admin_audit(p_actor,'order_recovery_'||next_action,p_id::text,jsonb_build_object('reason',left(p_reason,1000)));
end $$;
revoke all on function public.admin_recovery_case(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_recovery_case(uuid,uuid,text,text) to service_role;

-- Reuse the existing verified paid-checkout contact trigger. An optional
-- shopping phone never creates a recipient name or parcel collection time.
create or replace function public.copy_paid_parcel_contact() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='paid' and old.status is distinct from 'paid'
  and new.purpose='booking' and new.payment_method='stripe' and new.delivery_id is not null
  and new.booking_draft->>'recipient_phone' ~ '^\+44[1235789][0-9]{9}$' then
  if new.booking_draft->>'service_type'='delivery' and nullif(new.booking_draft->>'recipient_name','') is not null then
   update public.delivery_requests set recipient_name=left(new.booking_draft->>'recipient_name',100),
    recipient_phone=new.booking_draft->>'recipient_phone',collection_at=(new.booking_draft->>'collection_at')::timestamptz
   where id=new.delivery_id and customer_id=new.customer_id and service_type='delivery';
  elsif new.booking_draft->>'service_type'='buy_for_me' then
   update public.delivery_requests set recipient_phone=new.booking_draft->>'recipient_phone'
   where id=new.delivery_id and customer_id=new.customer_id and service_type='buy_for_me';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.copy_paid_parcel_contact() from public,anon,authenticated;
