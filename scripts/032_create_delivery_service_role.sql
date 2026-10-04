-- 032_create_delivery_service_role.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- CRITICAL money-function lockdown. Run in the Supabase SQL editor BEFORE
-- deploying the app change that calls create_delivery_with_wallet_payment_v2.
--
-- Problem: create_delivery_with_wallet_payment() is SECURITY DEFINER, takes
-- p_price from the caller, and was executable by every authenticated user (no
-- REVOKE anywhere), so a customer could call it straight from the browser with
-- p_price = 0.01 and bypass the server-side pricing in createDeliveryRequest().
-- credit_wallet_topup() and increment_wallet_balance() had the same exposure
-- (anyone could credit any wallet any amount).
--
-- Fix:
--   1. New _v2 function takes the customer id explicitly (auth.uid() is NULL
--      for the service-role client the server now uses) and is executable by
--      service_role ONLY.
--   2. The two wallet-crediting functions are service_role only.
-- The legacy create_delivery_with_wallet_payment() overloads are left in place
-- here so orders keep working until the new app version is live; remove them
-- afterwards with scripts/033_drop_legacy_create_delivery.sql.

create or replace function create_delivery_with_wallet_payment_v2(
  p_customer_id uuid,
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
  v_customer_id uuid := p_customer_id;
  v_balance numeric;
  v_delivery_id uuid;
  v_usage_limit_total int;
  v_usage_limit_per_user int;
  v_total_redemptions int;
  v_user_redemptions int;
begin
  if v_customer_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_price is null or p_price <= 0 then
    raise exception 'invalid_price';
  end if;

  -- Atomic re-check of promo code usage limits — locks the promo_codes row
  -- so concurrent redemption attempts for the SAME code serialize here,
  -- closing the race where the app-layer check (resolveDiscount, run before
  -- this function is even called) and the actual redemption insert were two
  -- separate, unsynchronized steps that concurrent requests could both pass.
  if p_promo_code_id is not null and p_discount_amount > 0 then
    perform 1 from promo_codes where id = p_promo_code_id for update;

    select usage_limit_total, usage_limit_per_user
      into v_usage_limit_total, v_usage_limit_per_user
    from promo_codes where id = p_promo_code_id;

    if v_usage_limit_total is not null then
      select count(*) into v_total_redemptions
      from promo_code_redemptions where promo_code_id = p_promo_code_id;
      if v_total_redemptions >= v_usage_limit_total then
        raise exception 'promo_code_limit_reached';
      end if;
    end if;

    select count(*) into v_user_redemptions
    from promo_code_redemptions
    where promo_code_id = p_promo_code_id and user_id = v_customer_id;
    if v_user_redemptions >= coalesce(v_usage_limit_per_user, 1) then
      raise exception 'promo_code_already_used';
    end if;
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

revoke execute on function public.create_delivery_with_wallet_payment_v2(uuid, text, text, numeric, numeric, numeric, numeric, text, numeric, text, text, text[], numeric, numeric, numeric, uuid, text) from public, anon, authenticated;
grant  execute on function public.create_delivery_with_wallet_payment_v2(uuid, text, text, numeric, numeric, numeric, numeric, text, numeric, text, text, text[], numeric, numeric, numeric, uuid, text) to service_role;

-- Idempotent: already applied manually, kept so a fresh database ends up secure.
revoke execute on function public.increment_wallet_balance(uuid, numeric) from public, anon, authenticated;
revoke execute on function public.credit_wallet_topup(uuid, numeric, text, text) from public, anon, authenticated;
grant  execute on function public.increment_wallet_balance(uuid, numeric) to service_role;
grant  execute on function public.credit_wallet_topup(uuid, numeric, text, text) to service_role;
