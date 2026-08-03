-- 022_driver_vehicles.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Drivers select a vehicle type (Bicycle/Motorcycle/Car/Van) with type-specific
-- details, and can register MULTIPLE vehicles. Job matching (in app code) uses
-- the UNION of package-size capabilities across ALL of a driver's vehicles —
-- there is no "active vehicle" switch. A driver running both a car and a van
-- should be offered jobs suited to either, simultaneously.
--
-- Run in the Supabase SQL editor.

create table if not exists driver_vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references users(id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('bicycle', 'motorcycle', 'car', 'van')),
  make text,
  model text,
  colour text,
  -- Required for motorcycle/car/van, not bicycle ("where applicable" / "for motor vehicles")
  registration_number text,
  driving_licence_details text,
  insurance_details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_vehicles_driver_id_idx on driver_vehicles (driver_id);

alter table driver_vehicles enable row level security;

drop policy if exists "Driver can manage own vehicles" on driver_vehicles;
create policy "Driver can manage own vehicles"
  on driver_vehicles for all
  using (auth.uid() = driver_id)
  with check (auth.uid() = driver_id);

drop policy if exists "Admin full access driver_vehicles" on driver_vehicles;
create policy "Admin full access driver_vehicles"
  on driver_vehicles for all
  using (
    exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

-- Deprecated: driver_profiles.vehicle_type / vehicle_number / insurance_details
-- were free-text single-vehicle leftovers from before multi-vehicle support.
-- App code now reads/writes driver_vehicles instead. Left in place (not
-- dropped) rather than destroying historical data — existing drivers' old
-- values are simply no longer read, and they'll be prompted to register a
-- proper vehicle in the new Bicycle/Motorcycle/Car/Van format.
comment on column driver_profiles.vehicle_type is 'DEPRECATED — superseded by driver_vehicles table';
comment on column driver_profiles.vehicle_number is 'DEPRECATED — superseded by driver_vehicles table';
comment on column driver_profiles.insurance_details is 'DEPRECATED — superseded by driver_vehicles table';

-- ── Package size on delivery_requests, for vehicle-capability job matching ──
alter table delivery_requests
  add column if not exists package_size text check (package_size in ('small', 'medium', 'large', 'bulky'));

-- ── Extend the wallet-payment RPC to accept + store package_size ───────────
-- CREATE OR REPLACE can add a new trailing parameter with a default value
-- without dropping the function first, as long as existing parameters are
-- unchanged — existing callers omitting the new arg keep working.
create or replace function create_delivery_with_wallet_payment(
  p_pickup_address text,
  p_delivery_address text,
  p_pickup_lat numeric,
  p_pickup_lng numeric,
  p_delivery_lat numeric,
  p_delivery_lng numeric,
  p_item_description text,
  p_price numeric,
  p_tracking_number text,
  p_package_size text default null
) returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_customer_id uuid := auth.uid();
  v_balance numeric;
  v_delivery_id uuid;
begin
  if v_customer_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_price is null or p_price <= 0 then
    raise exception 'invalid_price';
  end if;

  -- Row-lock the wallet so a double-submit or two concurrent tabs can't both
  -- read the same starting balance and both succeed.
  select balance into v_balance
  from wallet_balances
  where user_id = v_customer_id
  for update;

  if v_balance is null then
    v_balance := 0;
  end if;

  if v_balance < p_price then
    raise exception 'insufficient_funds';
  end if;

  insert into delivery_requests (
    customer_id, pickup_address, delivery_address,
    pickup_lat, pickup_lng, delivery_lat, delivery_lng,
    item_description, status, price, tracking_number, is_safe_confirmed,
    package_size
  ) values (
    v_customer_id, p_pickup_address, p_delivery_address,
    p_pickup_lat, p_pickup_lng, p_delivery_lat, p_delivery_lng,
    p_item_description, 'requested', p_price, p_tracking_number, true,
    p_package_size
  ) returning id into v_delivery_id;

  insert into wallet_balances (user_id, balance, updated_at)
  values (v_customer_id, -p_price, now())
  on conflict (user_id) do update
    set balance = wallet_balances.balance - p_price,
        updated_at = now();

  insert into wallet_transactions (user_id, type, amount, description, delivery_id)
  values (
    v_customer_id, 'deduction', -p_price,
    'Payment for delivery ' || p_tracking_number, v_delivery_id
  );

  insert into payments (delivery_id, amount, status, paid_at)
  values (v_delivery_id, p_price, 'paid', now());

  return v_delivery_id;
end;
$$;
