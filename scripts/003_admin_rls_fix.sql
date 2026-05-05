-- ============================================================
-- Add missing admin full-access RLS policies
-- Run this once in the Supabase SQL editor.
-- ============================================================

-- driver_profiles: admin full access (was missing entirely)
drop policy if exists "Admin full access driver_profiles" on driver_profiles;
create policy "Admin full access driver_profiles"
  on driver_profiles for all
  using (
    exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

-- driver_profiles: allow drivers to insert/update their own row
drop policy if exists "Driver can insert own profile" on driver_profiles;
create policy "Driver can insert own profile"
  on driver_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Driver can update own profile" on driver_profiles;
create policy "Driver can update own profile"
  on driver_profiles for update
  using (auth.uid() = id);

-- payouts: admin full access
drop policy if exists "Admin full access payouts" on payouts;
create policy "Admin full access payouts"
  on payouts for all
  using (
    exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

-- payouts: driver can view own payouts
drop policy if exists "Driver can view own payouts" on payouts;
create policy "Driver can view own payouts"
  on payouts for select
  using (auth.uid() = driver_id);

-- driver_earnings: admin full access
drop policy if exists "Admin full access driver_earnings" on driver_earnings;
create policy "Admin full access driver_earnings"
  on driver_earnings for all
  using (
    exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

-- driver_earnings: driver can view own earnings
drop policy if exists "Driver can view own earnings" on driver_earnings;
create policy "Driver can view own earnings"
  on driver_earnings for select
  using (auth.uid() = driver_id);

-- disputes: admin full access
drop policy if exists "Admin full access disputes" on disputes;
create policy "Admin full access disputes"
  on disputes for all
  using (
    exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

-- disputes: user can view disputes they raised
drop policy if exists "User can view own disputes" on disputes;
create policy "User can view own disputes"
  on disputes for select
  using (auth.uid() = raised_by);

-- delivery_status_logs: admin full access
drop policy if exists "Admin full access delivery_status_logs" on delivery_status_logs;
create policy "Admin full access delivery_status_logs"
  on delivery_status_logs for all
  using (
    exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

-- delivery_status_logs: drivers and customers can view logs for their deliveries
drop policy if exists "Driver can view delivery logs" on delivery_status_logs;
create policy "Driver can view delivery logs"
  on delivery_status_logs for select
  using (
    exists (
      select 1 from delivery_requests dr
      where dr.id = delivery_id and (dr.driver_id = auth.uid() or dr.customer_id = auth.uid())
    )
  );

-- delivery_status_logs: driver can insert logs
drop policy if exists "Driver can insert delivery logs" on delivery_status_logs;
create policy "Driver can insert delivery logs"
  on delivery_status_logs for insert
  with check (auth.uid() = updated_by);

-- delivery_requests: any authenticated driver can view unassigned (available) jobs
drop policy if exists "Driver can view available deliveries" on delivery_requests;
create policy "Driver can view available deliveries"
  on delivery_requests for select
  using (status = 'requested' and driver_id is null and auth.uid() is not null);

-- delivery_requests: driver can claim an unassigned job
drop policy if exists "Driver can claim available delivery" on delivery_requests;
create policy "Driver can claim available delivery"
  on delivery_requests for update
  using (status = 'requested' and driver_id is null)
  with check (auth.uid() = driver_id);

-- delivery_requests: driver can update their own assigned deliveries (status changes)
drop policy if exists "Driver can update assigned deliveries" on delivery_requests;
create policy "Driver can update assigned deliveries"
  on delivery_requests for update
  using (auth.uid() = driver_id);

-- support_tickets: admin full access
drop policy if exists "Admin full access support_tickets" on support_tickets;
create policy "Admin full access support_tickets"
  on support_tickets for all
  using (
    exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

-- support_tickets: user can view/create own tickets
drop policy if exists "User can manage own support tickets" on support_tickets;
create policy "User can manage own support tickets"
  on support_tickets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
