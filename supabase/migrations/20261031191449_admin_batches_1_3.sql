-- Keep application settings readable only through explicit safe columns.
-- Server-only administration uses service_role, never the browser role.
revoke all on public.surge_pricing_settings from public, anon, authenticated;
do $$ declare c record; begin
 for c in select column_name from information_schema.columns where table_schema='public' and table_name='surge_pricing_settings' loop
  execute format('revoke all (%I) on public.surge_pricing_settings from public, anon, authenticated',c.column_name);
 end loop;
end $$;
grant select(id,master_enabled,demand_enabled,demand_threshold_ratio,demand_multiplier,
 traffic_enabled,traffic_threshold_ratio,traffic_multiplier,max_total_multiplier,booking_pricing)
 on public.surge_pricing_settings to anon, authenticated;
grant all on public.surge_pricing_settings to service_role;
drop policy if exists "Admin full access surge_pricing_settings" on public.surge_pricing_settings;
drop policy if exists "Authenticated can read surge_pricing_settings" on public.surge_pricing_settings;
create policy "Read safe pricing columns" on public.surge_pricing_settings for select to anon,authenticated using(true);
alter table public.surge_pricing_settings add constraint valid_surge_ranges check (
 demand_threshold_ratio between 0.1 and 100 and demand_multiplier between 1 and 10
 and traffic_threshold_ratio between 1 and 10 and traffic_multiplier between 1 and 10
 and max_total_multiplier between 1 and 10);
alter table public.busy_period_rules add constraint valid_busy_multiplier check (multiplier between 1 and 10);

-- Stable customer/driver identity is independent of the current dashboard mode.
-- These views are private to server-side service_role queries.
create view public.admin_customer_accounts with (security_invoker=true) as
 select u.* from public.users u where u.role='customer'
 or exists(select 1 from public.customer_profiles c where c.id=u.id)
 or exists(select 1 from public.delivery_requests d where d.customer_id=u.id);
create view public.admin_driver_accounts with (security_invoker=true) as
 select u.* from public.users u where u.role='driver'
 or exists(select 1 from public.driver_profiles d where d.id=u.id);
revoke all on public.admin_customer_accounts,public.admin_driver_accounts from public,anon,authenticated;
grant select on public.admin_customer_accounts,public.admin_driver_accounts to service_role;

-- Use the same driver-profile lock as job assignment to serialize a mode switch
-- against concurrent acceptance. Returning to driver mode restores access to
-- existing active assignments; it never resets compliance or switches online.
create or replace function public.switch_account_mode(p_user uuid,p_role text)
returns void language plpgsql security definer set search_path=public as $$
declare previous_role text;
begin
 if p_role is null or p_role not in ('customer','driver') then raise exception 'invalid_mode'; end if;
 perform 1 from driver_profiles where id=p_user for update;
 select role into previous_role from users where id=p_user for update;
 if not found or previous_role='admin' then raise exception 'account_mode_unavailable'; end if;
 if p_role='driver' and not exists(select 1 from driver_profiles where id=p_user) then raise exception 'driver_profile_required'; end if;
 if p_role='customer' then
  if not exists(select 1 from customer_profiles where id=p_user) then raise exception 'customer_profile_required'; end if;
  if exists(select 1 from delivery_requests where driver_id=p_user and status in ('accepted','collected','picked_up','in_transit')) then raise exception 'active_delivery'; end if;
  update driver_profiles set is_online=false where id=p_user;
  delete from driver_locations where driver_id=p_user;
 end if;
 update users set role=p_role where id=p_user;
end $$;
revoke all on function public.switch_account_mode(uuid,text) from public,anon,authenticated;
grant execute on function public.switch_account_mode(uuid,text) to service_role;

create or replace function public.guard_driver_online_mode()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.is_online and not exists(select 1 from users where id=new.id and role='driver') then raise exception 'driver_mode_required'; end if;
 return new;
end $$;
revoke all on function public.guard_driver_online_mode() from public,anon,authenticated;
create trigger guard_driver_online_mode before insert or update of is_online on public.driver_profiles
 for each row execute function public.guard_driver_online_mode();
-- Remove stale online availability only. Preserve all profiles and active-job GPS.
update public.driver_profiles p set is_online=false
 where is_online and not exists(select 1 from public.users u where u.id=p.id and u.role='driver');

CREATE OR REPLACE FUNCTION public.admin_report_snapshot(p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare result jsonb; boundary timestamp:=now() at time zone 'UTC'-interval '30 days';
begin
 if not exists(select 1 from users where id=p_actor and role='admin') then raise exception 'admin_required'; end if;
 select jsonb_build_object(
 'orders',(select count(*) from delivery_requests where created_at>=boundary),
 'previousOrders',(select count(*) from delivery_requests where created_at>=boundary-interval '30 days' and created_at<boundary),
 'serviceFees',(select coalesce(sum(amount+commission_amount),0) from driver_earnings where created_at>=boundary),
 'driverEarnings',(select coalesce(sum(amount),0) from driver_earnings where created_at>=boundary),
 'commission',(select coalesce(sum(commission_amount),0) from driver_earnings where created_at>=boundary),
 'activeDrivers',(select count(*) from driver_profiles p where status='approved' and is_online and exists(select 1 from users u where u.id=p.id and u.role='driver')),
 'newCustomers',(select count(*) from admin_customer_accounts where created_at>=boundary),
 'statuses',(select coalesce(jsonb_agg(x),'[]') from (select status,count(*) as count from delivery_requests where created_at>=boundary group by status) x),
 'topDrivers',(select coalesce(jsonb_agg(x),'[]') from (select u.id,u.full_name,count(*) as completed from delivery_requests d join users u on u.id=d.driver_id where d.status='delivered' and d.created_at>=boundary group by u.id,u.full_name order by count(*) desc,u.id limit 5) x)
 ) into result;
 return result;
end $function$;

revoke all on function public.admin_report_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.admin_report_snapshot(uuid) to service_role;
