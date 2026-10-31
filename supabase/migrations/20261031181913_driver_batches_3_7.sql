-- Existing tables only. No customer payments are taken by this migration.
alter table public.driver_profiles add column verification_submitted_at timestamptz;
alter table public.driver_documents add column expires_on date;
alter table public.delivery_requests add column collection_wait jsonb;

create or replace function public.driver_compliance_ready(p_driver uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from driver_vehicles where driver_id=p_driver)
 and not exists(
  select required from unnest(case when exists(select 1 from driver_vehicles where driver_id=p_driver and vehicle_type<>'bicycle')
   then array['identity','selfie','insurance','vehicle_registration'] else array['identity','selfie'] end) required
  where not exists(select 1 from driver_documents where driver_id=p_driver and document_type=required
   and (expires_on is null or expires_on>=(now() at time zone 'Europe/London')::date)
   and (required<>'insurance' or expires_on is not null)))
$$;
revoke all on function public.driver_compliance_ready(uuid) from public,anon,authenticated;
grant execute on function public.driver_compliance_ready(uuid) to service_role;

create or replace function public.review_driver_compliance_change() returns trigger
language plpgsql security definer set search_path=public as $$
declare driver uuid;
begin
 if TG_OP='UPDATE' then
  if (to_jsonb(new)-'updated_at') is not distinct from (to_jsonb(old)-'updated_at') then return new; end if;
  if new.driver_id is distinct from old.driver_id then raise exception 'driver_owner_cannot_change'; end if;
 end if;
 if TG_OP='DELETE' then driver:=old.driver_id; else driver:=new.driver_id; end if;
 perform 1 from driver_profiles where id=driver for update;
 if exists(select 1 from delivery_requests where driver_id=driver and status in ('accepted','collected','picked_up','in_transit')) then raise exception 'finish_active_job_before_compliance_change'; end if;
 update driver_profiles set status=case when status='approved' then 'pending' else status end,is_online=false,verification_submitted_at=null where id=driver;
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
revoke all on function public.review_driver_compliance_change() from public,anon,authenticated;

create or replace function public.save_driver_document(p_driver uuid,p_type text,p_url text,p_expires date) returns uuid
language plpgsql security definer set search_path=public as $$
declare saved_id uuid;
begin
 if p_expires<(now() at time zone 'Europe/London')::date or (p_type='insurance' and p_expires is null) then raise exception 'valid_expiry_required'; end if;
 saved_id:=replace_driver_document(p_driver,p_type,p_url);
 update driver_documents set expires_on=p_expires where id=saved_id;
 return saved_id;
end $$;
revoke all on function public.save_driver_document(uuid,text,text,date) from public,anon,authenticated;
grant execute on function public.save_driver_document(uuid,text,text,date) to service_role;

create or replace function public.submit_driver_verification(p_driver uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from driver_profiles where id=p_driver and status<>'approved' for update;
 if not found or not exists(select 1 from users where id=p_driver and role='driver') or not driver_compliance_ready(p_driver) then raise exception 'complete_valid_documents_first'; end if;
 update driver_profiles set status='pending',verification_submitted_at=now() where id=p_driver;
end $$;
revoke all on function public.submit_driver_verification(uuid) from public,anon,authenticated;
grant execute on function public.submit_driver_verification(uuid) to service_role;

create or replace function public.approve_driver_verification(p_driver uuid,p_actor uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from users where id=p_actor and role='admin') then raise exception 'admin_required'; end if;
 perform 1 from driver_profiles where id=p_driver and verification_submitted_at is not null for update;
 if not found or not driver_compliance_ready(p_driver) then raise exception 'valid_submitted_documents_required'; end if;
 update driver_profiles set status='approved' where id=p_driver;
end $$;
revoke all on function public.approve_driver_verification(uuid,uuid) from public,anon,authenticated;
grant execute on function public.approve_driver_verification(uuid,uuid) to service_role;

-- Protect new claims even between daily expiry runs. Existing jobs can finish.
create or replace function public.guard_expired_driver_claim() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.driver_id is not null and (new.driver_id is distinct from old.driver_id or (old.status='requested' and new.status='accepted'))
 and exists(select 1 from driver_documents where driver_id=new.driver_id and (document_type in ('identity','selfie') or exists(select 1 from driver_vehicles where driver_id=new.driver_id and vehicle_type<>'bicycle')) and expires_on<(now() at time zone 'Europe/London')::date) then raise exception 'driver_documents_expired'; end if;
 return new;
end $$;
revoke all on function public.guard_expired_driver_claim() from public,anon,authenticated;
create trigger guard_expired_driver_claim before update on public.delivery_requests for each row execute function public.guard_expired_driver_claim();

create or replace function public.driver_compliance_reminders() returns integer
language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 perform pg_advisory_xact_lock(702637);
 insert into notifications(user_id,title,body,action_url)
 select distinct d.driver_id,'Driver document expiry','A document has expired or expires within 7 days. Upload a current copy before accepting new work.','/dashboard/driver/verification'
 from driver_documents d where (d.document_type in ('identity','selfie') or exists(select 1 from driver_vehicles where driver_id=d.driver_id and vehicle_type<>'bicycle')) and expires_on<=(now() at time zone 'Europe/London')::date+7
 and not exists(select 1 from notifications n where n.user_id=d.driver_id and n.title='Driver document expiry' and n.created_at>now()-interval '7 days');
 get diagnostics n=row_count;
 update driver_profiles p set status='pending',is_online=false,verification_submitted_at=null
 where status='approved' and exists(select 1 from driver_documents d where d.driver_id=p.id and (d.document_type in ('identity','selfie') or exists(select 1 from driver_vehicles where driver_id=p.id and vehicle_type<>'bicycle')) and expires_on<(now() at time zone 'Europe/London')::date)
 and not exists(select 1 from delivery_requests r where r.driver_id=p.id and status in ('accepted','collected','picked_up','in_transit'));
 return n;
end $$;
revoke all on function public.driver_compliance_reminders() from public,anon,authenticated;
grant execute on function public.driver_compliance_reminders() to service_role;

create index if not exists driver_jobs_history_idx on public.delivery_requests(driver_id,status,created_at desc,id);
create index if not exists driver_earnings_history_idx on public.driver_earnings(driver_id,created_at desc,id);
create index if not exists driver_payouts_history_idx on public.payouts(driver_id,created_at desc,id);
create index if not exists driver_documents_owner_type_idx on public.driver_documents(driver_id,document_type);

create or replace function public.driver_finance_snapshot(p_driver uuid,p_page integer default 1,p_period text default 'all',p_payouts boolean default false) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; boundary timestamptz;
begin
 if not exists(select 1 from users where id=p_driver and role='driver') then raise exception 'driver_required'; end if;
 boundary:=case p_period when 'day' then date_trunc('day',now() at time zone 'Europe/London') at time zone 'Europe/London'
 when 'week' then date_trunc('week',now() at time zone 'Europe/London') at time zone 'Europe/London'
 when 'month' then date_trunc('month',now() at time zone 'Europe/London') at time zone 'Europe/London' else '-infinity'::timestamptz end;
 with earnings as (
 select e.id::text,e.amount,e.commission_amount,e.status,e.created_at,to_jsonb(d) as delivery_requests from driver_earnings e left join delivery_requests d on d.id=e.delivery_id where e.driver_id=p_driver
 union all
 select 'legacy-'||d.id,coalesce(d.driver_earning_quote,round(d.price*.75,2)),d.price-coalesce(d.driver_earning_quote,round(d.price*.75,2)),'pending',coalesce(d.delivered_at,d.created_at),to_jsonb(d)
 from delivery_requests d where d.driver_id=p_driver and d.status='delivered' and d.price is not null and not exists(select 1 from driver_earnings e where e.delivery_id=d.id)
 ), totals as(select coalesce(sum(amount),0) total,coalesce(sum(amount) filter(where status='pending'),0) available,
 coalesce(sum(amount) filter(where created_at>=date_trunc('day',now() at time zone 'Europe/London') at time zone 'Europe/London'),0) today,count(*) filter(where created_at>=date_trunc('day',now() at time zone 'Europe/London') at time zone 'Europe/London') today_jobs,count(*) jobs from earnings)
 select jsonb_build_object('totals',(select to_jsonb(t) from totals t),'paid',coalesce((select sum(amount) from payouts where driver_id=p_driver and status='paid'),0),
 'count',case when p_payouts then (select count(*) from payouts where driver_id=p_driver) else (select count(*) from earnings where created_at>=boundary) end,
 'rows',case when p_payouts then (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,amount,status,created_at,payment_reference,provider from payouts where driver_id=p_driver order by created_at desc,id desc limit 20 offset (greatest(1,least(p_page,1000000))-1)*20)r)
 else (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,amount,commission_amount,status,created_at,jsonb_build_object('pickup_address',delivery_requests->>'pickup_address','tracking_number',delivery_requests->>'tracking_number','price',delivery_requests->'price') delivery_requests from earnings where created_at>=boundary order by created_at desc,id desc limit 20 offset (greatest(1,least(p_page,1000000))-1)*20)r) end) into result;
 return result;
end $$;
revoke all on function public.driver_finance_snapshot(uuid,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.driver_finance_snapshot(uuid,integer,text,boolean) to service_role;

-- Waiting is a consent request, never an automatic debit or a shopping-time fee.
create or replace function public.driver_collection_wait(p_id uuid,p_actor uuid,p_action text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype; state jsonb; rate numeric; elapsed numeric;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found or o.service_type<>'delivery' or o.status<>'accepted' then raise exception 'collection_wait_unavailable'; end if;
 state:=o.collection_wait;
 if p_action='start' and o.driver_id=p_actor then
  if state is not null then return state; end if;
  state:=jsonb_build_object('started_at',now(),'status','timing','free_minutes',5);
 elsif p_action='request' and o.driver_id=p_actor then
  if state->>'status'<>'timing' or state is null then raise exception 'start_wait_first'; end if;
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
end $$;
revoke all on function public.driver_collection_wait(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.driver_collection_wait(uuid,uuid,text) to service_role;
