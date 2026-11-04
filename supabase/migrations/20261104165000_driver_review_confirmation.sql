-- Recording a review is not a new upload or a change to vehicle details.
create or replace function public.review_driver_compliance_change() returns trigger
language plpgsql security definer set search_path=public as $$
declare driver uuid;
begin
 if tg_op='UPDATE' then
  if tg_table_name='driver_documents' then
   if (to_jsonb(new)-array['updated_at','review_status','reviewed_by','reviewed_at','review_reason'])
      is not distinct from (to_jsonb(old)-array['updated_at','review_status','reviewed_by','reviewed_at','review_reason']) then return new; end if;
  elsif (to_jsonb(new)-'updated_at') is not distinct from (to_jsonb(old)-'updated_at') then return new; end if;
  if new.driver_id is distinct from old.driver_id then raise exception 'driver_owner_cannot_change'; end if;
 end if;
 if tg_op='DELETE' then driver:=old.driver_id; else driver:=new.driver_id; end if;
 perform 1 from driver_profiles where id=driver for update;
 if exists(select 1 from delivery_requests where driver_id=driver and status in ('accepted','collected','picked_up','in_transit')) then
  raise exception 'finish_active_job_before_compliance_change';
 end if;
 update driver_profiles set status=case when status='approved' then 'pending' else status end,is_online=false,verification_submitted_at=null where id=driver;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.review_driver_compliance_change() from public,anon,authenticated;

-- The administrator attests to the exact files displayed in the review UI.
-- Replacements get new IDs. Never approve changed, rejected or expired files.
create or replace function public.admin_confirm_driver_approval(p_actor uuid,p_driver uuid,p_documents uuid[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare submitted timestamptz; state text; doc record; actual uuid[];
begin
 if not godrop_private.admin_has_scope(p_actor,'operations') then raise exception 'admin_required'; end if;
 select verification_submitted_at,status into submitted,state from driver_profiles where id=p_driver for update;
 if not found or state<>'pending' or submitted is null or not exists(select 1 from users where id=p_driver and account_status='active') then
  raise exception 'valid_submitted_documents_required';
 end if;
 perform 1 from driver_documents where driver_id=p_driver order by id for update nowait;
 select array_agg(id order by id) into actual from driver_documents where driver_id=p_driver;
 if actual is null or actual is distinct from (select array_agg(id order by id) from unnest(p_documents) as t(id)) then
  raise exception 'driver_documents_changed';
 end if;
 if exists(select 1 from driver_documents where driver_id=p_driver and review_status='rejected') then raise exception 'driver_document_rejected'; end if;
 if exists(select 1 from driver_documents where driver_id=p_driver and expires_on<(now() at time zone 'Europe/London')::date)
    or not driver_compliance_ready(p_driver) then raise exception 'driver_documents_invalid'; end if;
 for doc in select id from driver_documents where driver_id=p_driver and review_status='pending' order by id loop
  perform review_driver_document(p_actor,doc.id,'approved','Document reviewed during confirmed application approval');
 end loop;
 perform admin_review_driver(p_actor,p_driver,'approved','Application and displayed documents reviewed');
end $$;
revoke all on function public.admin_confirm_driver_approval(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.admin_confirm_driver_approval(uuid,uuid,uuid[]) to service_role;
