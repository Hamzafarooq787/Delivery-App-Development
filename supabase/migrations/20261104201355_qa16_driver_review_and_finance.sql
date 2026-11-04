alter table public.driver_profiles
 add column review_resume_online boolean,
 add column review_changed_fields text[] not null default '{}';

alter table public.addresses add column label text check (label is null or char_length(btrim(label)) between 1 and 60);

-- Recording a review is not a new upload or a change to vehicle details.
create or replace function public.review_driver_compliance_change() returns trigger
language plpgsql security definer set search_path=public as $$
declare driver uuid; state text; was_online boolean; changed text[] := '{}'; field text; before_row jsonb; after_row jsonb;
begin
 if tg_op='UPDATE' and new.driver_id is distinct from old.driver_id then raise exception 'driver_owner_cannot_change'; end if;
 if tg_op<>'INSERT' then before_row:=to_jsonb(old); end if;
 if tg_op<>'DELETE' then after_row:=to_jsonb(new); end if;
 if tg_table_name='driver_vehicles' and tg_op='UPDATE' then
  if before_row->'vehicle_type' is distinct from after_row->'vehicle_type' then changed:=array_append(changed,'Vehicle type'); end if;
  if upper(regexp_replace(coalesce(before_row->>'registration_number',''),'[[:space:]]','','g')) is distinct from
     upper(regexp_replace(coalesce(after_row->>'registration_number',''),'[[:space:]]','','g')) then changed:=array_append(changed,'Registration number'); end if;
  if coalesce(before_row->>'driving_licence_details','') is distinct from coalesce(after_row->>'driving_licence_details','') then changed:=array_append(changed,'Driving licence details'); end if;
  if coalesce(before_row->>'insurance_details','') is distinct from coalesce(after_row->>'insurance_details','') then changed:=array_append(changed,'Insurance details'); end if;
  if cardinality(changed)=0 then return new; end if;
 elsif tg_table_name='driver_vehicles' then
  changed:=array[case tg_op when 'INSERT' then 'Vehicle added' else 'Vehicle removed' end];
 else
  if tg_op='UPDATE' and (after_row-array['updated_at','review_status','reviewed_by','reviewed_at','review_reason'])
     is not distinct from (before_row-array['updated_at','review_status','reviewed_by','reviewed_at','review_reason']) then return new; end if;
  changed:=array['Document: '||replace(coalesce(after_row->>'document_type',before_row->>'document_type','unknown'),'_',' ')];
 end if;
 if tg_op='DELETE' then driver:=old.driver_id; else driver:=new.driver_id; end if;
 select status,is_online into state,was_online from driver_profiles where id=driver for update;
 if exists(select 1 from delivery_requests where driver_id=driver and status in ('accepted','collected','picked_up','in_transit')) then
  raise exception 'finish_active_job_before_compliance_change';
 end if;
 update driver_profiles set status=case when status='approved' then 'pending' else status end,is_online=false,verification_submitted_at=null,
  review_resume_online=case when state='approved' then was_online else review_resume_online end,
  review_changed_fields=case when state='approved' or review_resume_online is not null
   then array(select distinct name from unnest(review_changed_fields||changed) name order by name) else review_changed_fields end
  where id=driver;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.review_driver_compliance_change() from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.approve_driver_verification(p_driver uuid, p_actor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 perform set_config('app.admin_actor',p_actor::text,true);
 if exists(select 1 from driver_documents where driver_id=p_driver and review_status<>'approved') then raise exception 'review_documents_first';end if;
 if not godrop_private.admin_has_scope(p_actor,'operations') then raise exception 'admin_required'; end if;
 perform 1 from driver_profiles where id=p_driver and verification_submitted_at is not null for update;
 if not found or not driver_compliance_ready(p_driver) then raise exception 'valid_submitted_documents_required'; end if;
 update driver_profiles set status='approved',is_online=coalesce(review_resume_online,is_online) and exists(select 1 from users where id=p_driver and role='driver' and account_status='active'),review_resume_online=null,review_changed_fields='{}' where id=p_driver;
end $function$;

CREATE OR REPLACE FUNCTION public.driver_finance_snapshot(p_driver uuid, p_page integer DEFAULT 1, p_period text DEFAULT 'all'::text, p_payouts boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare result jsonb; boundary timestamptz;
begin
 if not exists(select 1 from users where id=p_driver and role='driver') then raise exception 'driver_required'; end if;
 boundary:=case p_period when 'day' then date_trunc('day',now() at time zone 'Europe/London') at time zone 'Europe/London'
 when 'week' then date_trunc('week',now() at time zone 'Europe/London') at time zone 'Europe/London'
 when 'month' then date_trunc('month',now() at time zone 'Europe/London') at time zone 'Europe/London' else '-infinity'::timestamptz end;
 with earnings as (
 select e.id::text,e.amount,e.commission_amount,e.status,(e.created_at at time zone 'UTC') as created_at,coalesce(to_jsonb(d),'{}'::jsonb)||jsonb_build_object('price',coalesce(p.amount,d.price),'adjustment',case when e.source_payment_id is not null then 'Collection waiting' when e.recovery_delivery_id is not null then 'Returned-job payment' else null end) as delivery_requests from driver_earnings e left join payments p on p.id=e.source_payment_id left join delivery_requests d on d.id=coalesce(e.delivery_id,e.recovery_delivery_id,p.related_delivery_id) where e.driver_id=p_driver
 union all
 select 'legacy-'||d.id,coalesce(d.driver_earning_quote,round(d.price*.75,2)),d.price-coalesce(d.driver_earning_quote,round(d.price*.75,2)),'pending',coalesce(d.delivered_at,d.created_at at time zone 'UTC'),to_jsonb(d)
 from delivery_requests d where d.driver_id=p_driver and d.status='delivered' and d.price is not null and not exists(select 1 from driver_earnings e where e.delivery_id=d.id)
 ), totals as(select coalesce(sum(amount),0) total,coalesce(sum(amount) filter(where status='pending'),0) available,
 coalesce(sum(amount) filter(where created_at>=date_trunc('day',now() at time zone 'Europe/London') at time zone 'Europe/London'),0) today,count(*) filter(where created_at>=date_trunc('day',now() at time zone 'Europe/London') at time zone 'Europe/London') today_jobs,count(*) jobs from earnings where created_at>=boundary)
 select jsonb_build_object('totals',(select to_jsonb(t) from totals t),'paid',coalesce((select sum(amount) from payouts where driver_id=p_driver and status='paid' and coalesce(processed_at,created_at at time zone 'UTC')>=boundary),0),
 'count',case when p_payouts then (select count(*) from payouts where driver_id=p_driver) else (select count(*) from earnings where created_at>=boundary) end,
 'rows',case when p_payouts then (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,amount,status,created_at at time zone 'UTC' as created_at,payment_reference,provider from payouts where driver_id=p_driver order by created_at desc,id desc limit 20 offset (greatest(1,least(p_page,1000000))-1)*20)r)
 else (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,amount,commission_amount,status,created_at,jsonb_build_object('pickup_address',delivery_requests->>'pickup_address','tracking_number',delivery_requests->>'tracking_number','price',delivery_requests->'price','adjustment',delivery_requests->>'adjustment') delivery_requests from earnings where created_at>=boundary order by created_at desc,id desc limit 20 offset (greatest(1,least(p_page,1000000))-1)*20)r) end) into result;
 return result;
end $function$;

alter table public.support_tickets add column incident_photo_key text;
revoke insert(incident_photo_key), update(incident_photo_key) on public.support_tickets from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('incident-evidence','incident-evidence',false,400000,array['image/jpeg'])
on conflict(id) do nothing;

-- Existing profile policies do not grant clients control over the review snapshot.
create function public.guard_driver_review_snapshot() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if current_setting('role',true) in ('anon','authenticated') then
  if tg_op='INSERT' then
   if new.review_resume_online is not null or cardinality(new.review_changed_fields)>0 then
    raise exception 'review_snapshot_protected';
   end if;
  elsif (new.review_resume_online,new.review_changed_fields) is distinct from (old.review_resume_online,old.review_changed_fields) then
   raise exception 'review_snapshot_protected';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_driver_review_snapshot() from public,anon,authenticated;
create trigger guard_driver_review_snapshot before insert or update on public.driver_profiles
for each row execute function public.guard_driver_review_snapshot();
