-- Live driver location tracking
-- One row per driver, upserted on each GPS ping.

create table if not exists driver_locations (
  driver_id uuid primary key references users(id) on delete cascade,
  delivery_id uuid references delivery_requests(id) on delete set null,
  lat numeric not null,
  lng numeric not null,
  heading numeric,
  speed numeric,
  accuracy numeric,
  updated_at timestamp not null default now()
);

create index if not exists driver_locations_delivery_idx
  on driver_locations(delivery_id);

create index if not exists driver_locations_updated_idx
  on driver_locations(updated_at desc);

alter table driver_locations enable row level security;

-- Drivers can upsert their own location
drop policy if exists "drivers manage own location" on driver_locations;
create policy "drivers manage own location"
  on driver_locations
  for all
  using (auth.uid() = driver_id)
  with check (auth.uid() = driver_id);

-- Customers can read the location of the driver delivering their active order
drop policy if exists "customers read assigned driver location" on driver_locations;
create policy "customers read assigned driver location"
  on driver_locations
  for select
  using (
    exists (
      select 1 from delivery_requests d
      where d.driver_id = driver_locations.driver_id
        and d.customer_id = auth.uid()
        and d.status in ('accepted', 'collected', 'in_transit', 'picked_up')
    )
  );

-- Admins can read all
drop policy if exists "admins read all locations" on driver_locations;
create policy "admins read all locations"
  on driver_locations
  for select
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

-- Enable Realtime publication for live subscriptions
alter publication supabase_realtime add table driver_locations;
