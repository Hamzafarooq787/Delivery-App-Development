-- 024_promotions_and_surge_pricing.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Discounts & Promotions: manual promo codes (seasonal/general) plus automatic
-- discounts (first delivery, loyalty — no code needed, per business decision).
--
-- Dynamic/Surge Pricing: price multiplier from busy periods (admin-configured
-- time rules), high demand (live ratio of pending orders to online drivers),
-- and heavy traffic (Google Maps traffic-aware duration vs static duration).
-- Weather-based surge is intentionally NOT included — deferred until a
-- weather API is set up. Surge factors combine via MAX (not multiplicative),
-- capped at max_total_multiplier, to avoid runaway compounding.
--
-- Run in the Supabase SQL editor.

-- ═══════════════════════════════════════════════════════════════════════════
-- Promo codes (manual entry — seasonal/general promotions)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric not null check (discount_value > 0),
  -- Caps the discount amount for percentage codes (e.g. "20% off, max £10").
  -- Ignored for fixed-amount codes.
  max_discount_amount numeric,
  min_order_value numeric,
  usage_limit_total int,
  usage_limit_per_user int not null default 1,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  active boolean not null default true,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index if not exists promo_codes_code_idx on promo_codes (upper(code));

alter table promo_codes enable row level security;

drop policy if exists "Admin full access promo_codes" on promo_codes;
create policy "Admin full access promo_codes"
  on promo_codes for all
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

drop policy if exists "Authenticated can read active promo codes" on promo_codes;
create policy "Authenticated can read active promo codes"
  on promo_codes for select
  to authenticated
  using (active = true);

-- Redemption log — enforces per-user/total usage limits and provides an audit trail.
create table if not exists promo_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references promo_codes(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  delivery_id uuid references delivery_requests(id) on delete set null,
  discount_amount numeric not null,
  redeemed_at timestamptz not null default now()
);

create index if not exists promo_code_redemptions_promo_idx on promo_code_redemptions (promo_code_id);
create index if not exists promo_code_redemptions_user_idx on promo_code_redemptions (user_id);

alter table promo_code_redemptions enable row level security;

drop policy if exists "Admin full access promo_code_redemptions" on promo_code_redemptions;
create policy "Admin full access promo_code_redemptions"
  on promo_code_redemptions for all
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

drop policy if exists "User sees own redemptions" on promo_code_redemptions;
create policy "User sees own redemptions" on promo_code_redemptions
  for select using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Automatic discounts (first delivery, loyalty — applied without a code)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists automatic_discounts (
  type text primary key check (type in ('first_order', 'loyalty')),
  active boolean not null default false,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric not null check (discount_value > 0),
  max_discount_amount numeric,
  -- loyalty only: reward every Nth delivered order (e.g. 5 = every 5th order)
  loyalty_order_threshold int,
  updated_at timestamptz not null default now()
);

insert into automatic_discounts (type, active, discount_type, discount_value, max_discount_amount, loyalty_order_threshold)
values
  ('first_order', false, 'percentage', 15, 10, null),
  ('loyalty',     false, 'percentage', 10, 10, 5)
on conflict (type) do nothing;

alter table automatic_discounts enable row level security;

drop policy if exists "Admin full access automatic_discounts" on automatic_discounts;
create policy "Admin full access automatic_discounts"
  on automatic_discounts for all
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

drop policy if exists "Authenticated can read automatic_discounts" on automatic_discounts;
create policy "Authenticated can read automatic_discounts"
  on automatic_discounts for select to authenticated using (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Surge pricing settings (single row) + busy period rules
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists surge_pricing_settings (
  id boolean primary key default true check (id = true), -- enforces a single row
  master_enabled boolean not null default false,
  demand_enabled boolean not null default true,
  -- surge kicks in when (pending orders / online drivers) exceeds this ratio
  demand_threshold_ratio numeric not null default 1.5,
  demand_multiplier numeric not null default 1.3,
  traffic_enabled boolean not null default true,
  -- surge kicks in when duration_in_traffic / duration exceeds this ratio
  traffic_threshold_ratio numeric not null default 1.4,
  traffic_multiplier numeric not null default 1.25,
  max_total_multiplier numeric not null default 2.0,
  updated_at timestamptz not null default now()
);

insert into surge_pricing_settings (id) values (true) on conflict (id) do nothing;

alter table surge_pricing_settings enable row level security;

drop policy if exists "Admin full access surge_pricing_settings" on surge_pricing_settings;
create policy "Admin full access surge_pricing_settings"
  on surge_pricing_settings for all
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

drop policy if exists "Authenticated can read surge_pricing_settings" on surge_pricing_settings;
create policy "Authenticated can read surge_pricing_settings"
  on surge_pricing_settings for select to authenticated using (true);

create table if not exists busy_period_rules (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  -- 0=Sunday..6=Saturday, null = applies every day
  day_of_week int check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  multiplier numeric not null check (multiplier >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table busy_period_rules enable row level security;

drop policy if exists "Admin full access busy_period_rules" on busy_period_rules;
create policy "Admin full access busy_period_rules"
  on busy_period_rules for all
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

drop policy if exists "Authenticated can read busy_period_rules" on busy_period_rules;
create policy "Authenticated can read busy_period_rules"
  on busy_period_rules for select to authenticated using (active = true);

-- ═══════════════════════════════════════════════════════════════════════════
-- delivery_requests: record the pricing breakdown, not just the final charge
-- ═══════════════════════════════════════════════════════════════════════════
alter table delivery_requests
  add column if not exists base_price numeric,
  add column if not exists surge_multiplier numeric not null default 1,
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists promo_code text;

-- ═══════════════════════════════════════════════════════════════════════════
-- Extend the wallet-payment RPC to record the full pricing breakdown and log
-- a promo code redemption. p_price remains the FINAL charged amount (after
-- surge and discount) — wallet deduction logic is unchanged.
-- ═══════════════════════════════════════════════════════════════════════════
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
  p_package_size text default null,
  p_item_photo_urls text[] default null,
  p_base_price numeric default null,
  p_surge_multiplier numeric default 1,
  p_discount_amount numeric default 0,
  p_promo_code_id uuid default null,
  p_promo_code text default null
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
    package_size, item_photo_urls,
    base_price, surge_multiplier, discount_amount, promo_code
  ) values (
    v_customer_id, p_pickup_address, p_delivery_address,
    p_pickup_lat, p_pickup_lng, p_delivery_lat, p_delivery_lng,
    p_item_description, 'requested', p_price, p_tracking_number, true,
    p_package_size, p_item_photo_urls,
    coalesce(p_base_price, p_price), p_surge_multiplier, p_discount_amount, p_promo_code
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

  if p_promo_code_id is not null and p_discount_amount > 0 then
    insert into promo_code_redemptions (promo_code_id, user_id, delivery_id, discount_amount)
    values (p_promo_code_id, v_customer_id, v_delivery_id, p_discount_amount);
  end if;

  return v_delivery_id;
end;
$$;
