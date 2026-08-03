-- 023_item_description_photos.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Customers can now enter a detailed free-text description of the item being
-- delivered (item_description already existed but was previously just a fixed
-- "Standard Box / Heavy Pallet / Fragile" label) and optionally upload photos
-- of the item at order-creation time.
--
-- Note: parcel_image_url (scripts/012_parcel_photo.sql) is a SEPARATE,
-- existing field — the driver's collection-proof photo taken when marking a
-- delivery "collected". item_photo_urls below is the customer's own photos
-- of the item, submitted when placing the order. Do not conflate the two.
--
-- Run in the Supabase SQL editor.

-- ── Storage bucket for customer-submitted item photos ───────────────────────
insert into storage.buckets (id, name, public)
values ('delivery-item-photos', 'delivery-item-photos', true)
on conflict (id) do nothing;

drop policy if exists "Customer can upload own item photos" on storage.objects;
create policy "Customer can upload own item photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'delivery-item-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Public can read item photos" on storage.objects;
create policy "Public can read item photos"
  on storage.objects for select
  to public
  using (bucket_id = 'delivery-item-photos');

-- ── item_photo_urls column ──────────────────────────────────────────────────
alter table delivery_requests
  add column if not exists item_photo_urls text[];

-- ── Extend the wallet-payment RPC to accept + store item photo URLs ────────
-- Adds a new trailing default parameter — existing callers omitting it keep
-- working (same pattern as the package_size addition in 022).
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
  p_item_photo_urls text[] default null
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
    package_size, item_photo_urls
  ) values (
    v_customer_id, p_pickup_address, p_delivery_address,
    p_pickup_lat, p_pickup_lng, p_delivery_lat, p_delivery_lng,
    p_item_description, 'requested', p_price, p_tracking_number, true,
    p_package_size, p_item_photo_urls
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
