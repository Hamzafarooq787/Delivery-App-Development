-- Customer live locations table
create table if not exists customer_locations (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  delivery_id uuid references delivery_requests(id) on delete set null,
  updated_at timestamptz default now()
);

alter table customer_locations enable row level security;

-- Customers manage their own location
create policy "customers manage own location" on customer_locations
  for all using (auth.uid() = customer_id) with check (auth.uid() = customer_id);

-- Drivers and admins can read all customer locations (to find customers)
create policy "drivers read customer locations" on customer_locations
  for select using (true);

-- Enable Supabase Realtime on this table
alter publication supabase_realtime add table customer_locations;
