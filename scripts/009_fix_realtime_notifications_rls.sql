-- ============================================================
-- Fix Supabase Realtime notifications for all roles
-- ============================================================

-- 1. Enable Realtime on delivery_requests (idempotent - safe to re-run)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'delivery_requests'
  ) then
    alter publication supabase_realtime add table delivery_requests;
  end if;
end $$;

-- 2. Enable Realtime on driver_profiles (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'driver_profiles'
  ) then
    alter publication supabase_realtime add table driver_profiles;
  end if;
end $$;

-- 3. Allow drivers to SELECT open (unassigned) delivery requests so
--    Supabase Realtime can deliver INSERT events to them.
--    Without this policy, RLS silently blocks the realtime event.
drop policy if exists "Drivers can view open delivery requests" on delivery_requests;
create policy "Drivers can view open delivery requests"
  on delivery_requests for select
  using (
    status = 'requested'
    and driver_id is null
    and exists (
      select 1 from users where id = auth.uid() and role = 'driver'
    )
  );

-- 4. Also allow drivers to UPDATE delivery requests they are claiming
--    (status: requested → accepted) and their own assigned deliveries.
drop policy if exists "Driver can update assigned or claim open deliveries" on delivery_requests;
create policy "Driver can update assigned or claim open deliveries"
  on delivery_requests for update
  using (
    auth.uid() = driver_id
    or (
      driver_id is null
      and status = 'requested'
      and exists (
        select 1 from users where id = auth.uid() and role = 'driver'
      )
    )
  );
