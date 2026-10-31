-- Driver batches 1 and 2. Existing tables only.
-- Offers are returned by the approved-driver server action, never as whole rows.
drop policy if exists "Drivers can view open delivery requests" on public.delivery_requests;

-- Every driver file is append-only. Replacements must use a new upload path.
-- This also protects identity documents and proof before an order is committed.
drop policy if exists "Driver can delete own documents" on storage.objects;
drop policy if exists "Driver can update own documents" on storage.objects;
revoke insert, update, delete on public.driver_vehicles, public.driver_documents from anon, authenticated;

create or replace function public.review_driver_compliance_change() returns trigger
language plpgsql security definer set search_path=public as $$
declare driver uuid; current_status text;
begin
 if TG_OP='UPDATE' then
  if (to_jsonb(new)-'updated_at') is not distinct from (to_jsonb(old)-'updated_at') then return new; end if;
  if new.driver_id is distinct from old.driver_id then raise exception 'driver_owner_cannot_change'; end if;
 end if;
 if TG_OP='DELETE' then driver:=old.driver_id; else driver:=new.driver_id; end if;
 select status into current_status from driver_profiles where id=driver for update;
 if exists(select 1 from delivery_requests where driver_id=driver and status in ('accepted','collected','picked_up','in_transit')) then
  raise exception 'finish_active_job_before_compliance_change';
 end if;
 if current_status='approved' then
  update driver_profiles set status='pending',is_online=false where id=driver;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.review_driver_compliance_change() from public,anon,authenticated;
create trigger review_vehicle_change before insert or update or delete on public.driver_vehicles
for each row execute function public.review_driver_compliance_change();
create trigger review_document_change before insert or update or delete on public.driver_documents
for each row execute function public.review_driver_compliance_change();

-- Parent lock serializes replacement and preserves the old record on any failure.
create or replace function public.replace_driver_document(p_driver uuid,p_type text,p_url text) returns uuid
language plpgsql security definer set search_path=public as $$
declare document_id uuid;
begin
 if p_type not in ('identity','selfie','insurance','vehicle_registration') or nullif(p_url,'') is null
 or not exists(select 1 from users where id=p_driver and role='driver') then raise exception 'invalid_driver_document'; end if;
 perform 1 from driver_profiles where id=p_driver for update;
 if not found then raise exception 'driver_profile_required'; end if;
 delete from driver_documents where driver_id=p_driver and document_type=p_type;
 insert into driver_documents(driver_id,document_type,file_url) values(p_driver,p_type,p_url) returning id into document_id;
 return document_id;
end $$;
revoke all on function public.replace_driver_document(uuid,text,text) from public,anon,authenticated;
grant execute on function public.replace_driver_document(uuid,text,text) to service_role;

create or replace function public.guard_driver_assignment() returns trigger
language plpgsql security definer set search_path=public as $$
declare approved text; suitable boolean:=false; vehicle record;
begin
 if old.company_card_reference is not null and new.driver_id is distinct from old.driver_id then raise exception 'cancel_funded_shopping_before_reassignment'; end if;
 if new.driver_id is null or (new.driver_id is not distinct from old.driver_id and not(old.status='requested' and new.status='accepted')) then return new; end if;
 -- Serialize claims for this driver, including simultaneous claims of different jobs.
 select status into approved from driver_profiles where id=new.driver_id for update;
 if approved is distinct from 'approved' or not exists(select 1 from users where id=new.driver_id and role='driver') then raise exception 'driver_not_approved'; end if;
 if exists(select 1 from delivery_requests where driver_id=new.driver_id and id<>new.id and status in ('accepted','collected','picked_up','in_transit')) then raise exception 'driver_has_active_job'; end if;
 for vehicle in select vehicle_type from driver_vehicles where driver_id=new.driver_id for share loop
  if new.package_size is null or vehicle.vehicle_type='van' or (vehicle.vehicle_type='car' and new.package_size in ('small','medium','large')) or (vehicle.vehicle_type='motorcycle' and new.package_size in ('small','medium')) or (vehicle.vehicle_type='bicycle' and new.package_size='small') then suitable:=true; end if;
 end loop;
 if not suitable then raise exception 'suitable_vehicle_required'; end if;
 perform 1 from payments where delivery_id=new.id and status='paid' for share;
 if not found then raise exception 'confirmed_payment_required'; end if;
 return new;
end $$;
revoke all on function public.guard_driver_assignment() from public,anon,authenticated;

-- Browser writes cannot bypass the assigned-active-job and timestamp checks.
drop policy if exists "drivers manage own location" on public.driver_locations;
create policy "drivers read own location" on public.driver_locations for select to authenticated using ((select auth.uid())=driver_id);
revoke insert,update,delete on public.driver_locations from anon,authenticated;
create or replace function public.publish_driver_location(p_driver uuid,p_job uuid,p_lat double precision,p_lng double precision,p_measured timestamptz,p_heading double precision default null,p_speed double precision default null,p_accuracy double precision default null) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 if p_lat is null or p_lng is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180)
 or p_measured is null or p_measured<now()-interval '45 seconds' or p_measured>now()+interval '5 seconds' then raise exception 'fresh_gps_required'; end if;
 perform 1 from delivery_requests where id=p_job and driver_id=p_driver and status in ('accepted','collected','picked_up','in_transit') for share;
 if not found or not exists(select 1 from driver_profiles d join users u on u.id=d.id where d.id=p_driver and d.status='approved' and u.role='driver') then raise exception 'active_assigned_job_required'; end if;
 insert into driver_locations(driver_id,delivery_id,lat,lng,heading,speed,accuracy,updated_at)
 values(p_driver,p_job,p_lat,p_lng,p_heading,p_speed,p_accuracy,p_measured)
 on conflict(driver_id) do update set delivery_id=excluded.delivery_id,lat=excluded.lat,lng=excluded.lng,heading=excluded.heading,speed=excluded.speed,accuracy=excluded.accuracy,updated_at=excluded.updated_at
 where driver_locations.updated_at<excluded.updated_at;
 return found;
end $$;
revoke all on function public.publish_driver_location(uuid,uuid,double precision,double precision,timestamptz,double precision,double precision,double precision) from public,anon,authenticated;
grant execute on function public.publish_driver_location(uuid,uuid,double precision,double precision,timestamptz,double precision,double precision,double precision) to service_role;

create or replace function public.complete_order_with_otp(p_id uuid,p_driver uuid,p_code text,p_photo text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype; code delivery_otps%rowtype;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found or o.driver_id is distinct from p_driver or length(coalesce(p_photo,''))=0 then return jsonb_build_object('error','Order is not ready for completion'); end if;
 select * into code from delivery_otps where delivery_id=p_id for update;
 if o.status='delivered' and code.verified_at is not null and trim(p_code)=code.otp then return jsonb_build_object('success',true); end if;
 if o.status<>'in_transit' or (o.service_type='buy_for_me' and (o.bfm_stage is distinct from 'heading_to_customer' or o.receipt_url is null or o.purchase_confirmed_at is null)) then return jsonb_build_object('error','Order is not ready for completion'); end if;
 if code.delivery_id is null or code.attempts>=5 then return jsonb_build_object('error','Contact support for a new delivery code'); end if;
 if trim(p_code) is distinct from code.otp then
  update delivery_otps set attempts=attempts+1 where delivery_id=p_id;
  return jsonb_build_object('error','Incorrect delivery code','attemptsRemaining',greatest(0,4-code.attempts));
 end if;
 update delivery_requests set status='delivered',delivered_at=now(),delivered_image_url=p_photo,
 bfm_stage=case when service_type='buy_for_me' then 'delivered' else bfm_stage end where id=p_id;
 update delivery_otps set verified_at=now() where delivery_id=p_id;
 insert into delivery_status_logs(delivery_id,status,updated_by) values(p_id,'delivered',p_driver);
 delete from driver_locations where driver_id=p_driver and delivery_id=p_id;
 return jsonb_build_object('success',true);
end $$;
revoke all on function public.complete_order_with_otp(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.complete_order_with_otp(uuid,uuid,text,text) to service_role;
