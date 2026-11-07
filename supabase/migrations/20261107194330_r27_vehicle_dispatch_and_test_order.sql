-- Match the job to a compliant vehicle, not to every vehicle on the account.
-- Submission still checks all registered vehicles via driver_compliance_ready.
create or replace function public.driver_dispatch_sizes(p_driver uuid)
returns text[] language sql stable security definer set search_path = public as $$
 select coalesce(array_agg(distinct capacity.size), array[]::text[])
 from driver_vehicles v
 cross join lateral unnest(case v.vehicle_type
   when 'bicycle' then array['small']
   when 'motorcycle' then array['small','medium']
   when 'car' then array['small','medium','large']
   when 'van' then array['small','medium','large','bulky']
   else array[]::text[] end) capacity(size)
 where v.driver_id=p_driver and not exists (
   select 1 from unnest(case when v.vehicle_type='bicycle' then array['identity','selfie']
     else array['identity','selfie','insurance','vehicle_registration'] end) required(kind)
   where not exists (
     select 1 from driver_documents d where d.driver_id=p_driver and d.document_type=required.kind
     and d.review_status is distinct from 'rejected'
     and (d.expires_on is null or d.expires_on >= (now() at time zone 'Europe/London')::date)
     and (required.kind <> 'insurance' or d.expires_on is not null)
   )
 )
$$;
revoke all on function public.driver_dispatch_sizes(uuid) from public, anon, authenticated;
grant execute on function public.driver_dispatch_sizes(uuid) to service_role;

create or replace function public.guard_driver_claim_compliance()
returns trigger language plpgsql security definer set search_path = public as $$
declare sizes text[];
begin
 if new.driver_id is not null and (old.driver_id is distinct from new.driver_id or old.status='requested' and new.status='accepted') then
   sizes:=driver_dispatch_sizes(new.driver_id);
   if cardinality(sizes)=0 or (new.package_size is not null and not(new.package_size=any(sizes))) then
     raise exception 'driver_documents_incomplete';
   end if;
 end if;
 return new;
end
$$;
revoke all on function public.guard_driver_claim_compliance() from public, anon, authenticated;

-- This older account-wide check is now covered by the per-vehicle guard.
drop trigger if exists guard_expired_driver_claim on public.delivery_requests;

create or replace function public.eligible_delivery_drivers(p_id uuid)
returns uuid[] language sql stable security definer set search_path = public as $$
 select coalesce(array_agg(p.id), '{}'::uuid[])
 from driver_profiles p join users u on u.id=p.id join delivery_requests d on d.id=p_id
 cross join lateral (select driver_dispatch_sizes(p.id) as sizes) eligible
 where d.status='requested' and d.driver_id is null
 and coalesce(d.recovery_case->>'status','') <> 'open'
 and d.pickup_lat between 49.8 and 61.1 and d.pickup_lng between -8.7 and 1.9
 and d.delivery_lat between 49.8 and 61.1 and d.delivery_lng between -8.7 and 1.9
 and exists(select 1 from payments x where x.delivery_id=d.id and x.purpose='booking' and x.status='paid')
 and u.role='driver' and u.account_status='active' and p.status='approved' and p.is_online
 and p.delivery_alerts is distinct from false and p.notifications_enabled is distinct from false
 and not exists(select 1 from delivery_requests a where a.driver_id=p.id and a.status in ('accepted','collected','picked_up','in_transit'))
 and cardinality(eligible.sizes)>0 and (d.package_size is null or d.package_size=any(eligible.sizes))
$$;
revoke all on function public.eligible_delivery_drivers(uuid) from public, anon, authenticated;
grant execute on function public.eligible_delivery_drivers(uuid) to service_role;

-- Warn about expiry as before; keep an approved driver eligible if another
-- registered vehicle still has all of its required current documents.
create or replace function public.driver_compliance_reminders() returns integer
language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 perform pg_advisory_xact_lock(702637);
 insert into notifications(user_id,title,body,action_url)
 select distinct d.driver_id,'Driver document expiry','A document has expired or expires within 7 days. Upload a current copy before using the affected vehicle.','/dashboard/driver/verification'
 from driver_documents d where (d.document_type in ('identity','selfie') or exists(select 1 from driver_vehicles v where v.driver_id=d.driver_id and v.vehicle_type<>'bicycle')) and d.expires_on<=(now() at time zone 'Europe/London')::date+7
 and not exists(select 1 from notifications n where n.user_id=d.driver_id and n.title='Driver document expiry' and n.created_at>now()-interval '7 days');
 get diagnostics n=row_count;
 update driver_profiles p set status='pending',is_online=false,verification_submitted_at=null
 where p.status='approved' and cardinality(driver_dispatch_sizes(p.id))=0
 and exists(select 1 from driver_documents d where d.driver_id=p.id and (d.document_type in ('identity','selfie') or exists(select 1 from driver_vehicles v where v.driver_id=p.id and v.vehicle_type<>'bicycle')) and d.expires_on<(now() at time zone 'Europe/London')::date)
 and not exists(select 1 from delivery_requests r where r.driver_id=p.id and status in ('accepted','collected','picked_up','in_transit'));
 return n;
end
$$;
revoke all on function public.driver_compliance_reminders() from public, anon, authenticated;
grant execute on function public.driver_compliance_reminders() to service_role;

-- QA fixture: one 2L milk item was incorrectly stamped Medium by the old form.
-- Keep the original charge, shopping budget, driver quote and payment intact.
update public.delivery_requests d
set package_size='small'
where d.id='8ab40490-97c6-4f82-98a3-5866eac85aaa' and d.tracking_number='GD-C850BAC3'
and d.service_type='buy_for_me' and d.status='requested' and d.driver_id is null
and d.package_size='medium' and d.estimated_items_total=2 and d.max_spend_approved=50
and exists(select 1 from public.payments p where p.delivery_id=d.id and p.purpose='booking' and p.payment_method='stripe' and p.status='paid' and p.amount=58.48)
and (select count(*) from public.shopping_items i where i.delivery_id=d.id)=1
and exists(select 1 from public.shopping_items i where i.delivery_id=d.id and i.quantity=1 and i.estimated_price=2 and i.name ilike '%milk%');
