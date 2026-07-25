-- 021_delivery_wallet_payment.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Customers must now fund their wallet before placing an order — the delivery
-- price is deducted from the wallet at the moment the order is created.
--
-- create_delivery_with_wallet_payment() does everything in ONE database
-- transaction: lock the wallet row, verify sufficient balance, insert the
-- delivery, deduct the balance, log the wallet transaction, and record a
-- "paid" payments row for the Payments/Charges tab. Either all of it happens
-- or none of it does — this also prevents a double-submit (or two browser
-- tabs) from double-spending the same balance, via `for update` row locking.
--
-- Run in the Supabase SQL editor.

create or replace function create_delivery_with_wallet_payment(
  p_pickup_address text,
  p_delivery_address text,
  p_pickup_lat numeric,
  p_pickup_lng numeric,
  p_delivery_lat numeric,
  p_delivery_lng numeric,
  p_item_description text,
  p_price numeric,
  p_tracking_number text
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
    item_description, status, price, tracking_number, is_safe_confirmed
  ) values (
    v_customer_id, p_pickup_address, p_delivery_address,
    p_pickup_lat, p_pickup_lng, p_delivery_lat, p_delivery_lng,
    p_item_description, 'requested', p_price, p_tracking_number, true
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
