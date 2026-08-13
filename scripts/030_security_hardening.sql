-- 030_security_hardening.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Comprehensive fixes from a full security audit. Every item here closes a
-- real, exploitable gap — several allowed trivial full account/data
-- compromise. Run this in the Supabase SQL editor.
--
-- Summary of what's fixed:
--   1. users.role — closes a customer-self-promotes-to-admin hole (no
--      column-level restriction existed; RLS's `using` only checked the
--      row, not which columns could change).
--   2. driver_profiles.status — closes a driver-self-approves hole (same
--      root cause as #1).
--   3. delivery_requests — removes the driver-side UPDATE policies. Every
--      legitimate driver mutation already goes through a vetted server
--      action using the admin client (acceptDelivery, updateDeliveryStatus,
--      markParcelCollected, verifyDeliveryOtpAndComplete) — these RLS
--      policies had no WITH CHECK and let an assigned driver rewrite ANY
--      column, including price and status (bypassing OTP verification
--      entirely).
--   4. wallet_balances — removes a policy letting customers set their own
--      balance to anything, and a "service role" policy that (missing
--      `to service_role`) actually applied to every authenticated client.
--   5. wallet_transactions / chat_sessions / chat_messages / notifications —
--      same "service role" policy bug: `using (true) with check (true)`
--      with no `to service_role` clause applied to everyone, not just the
--      service role (which bypasses RLS anyway and never needed these).
--   6. customer_locations — was readable by any authenticated client with
--      no scoping at all; now scoped like the equivalent driver_locations
--      policy (only the driver on an active delivery with that customer).
--   7. delivery_status_logs — INSERT only checked the inserter's identity,
--      not that they're actually the delivery's driver.
--   8. driver-documents storage bucket — restores folder-scoped
--      INSERT/UPDATE/DELETE (a prior migration accidentally opened these to
--      any authenticated user, any path) and narrows public SELECT to
--      authenticated-only.
--   9. create_delivery_with_wallet_payment() — adds an atomic, row-locked
--      re-check of promo code usage limits inside the transaction, closing
--      a TOCTOU race where concurrent requests could each pass the
--      app-layer eligibility check before any redemption row existed.
--  10. New cancel_delivery_order() RPC — makes cancellation (refund or fee)
--      and the status flip atomic, closing a race where concurrent cancel
--      calls on the same order could each read "not yet refunded" and both
--      credit the refund.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. users.role — lock down to a specific, safe column list
-- ═══════════════════════════════════════════════════════════════════════════
revoke update on public.users from authenticated;
grant update (full_name, phone, marketing_email_opt_in, marketing_push_opt_in, marketing_consent_updated_at)
  on public.users to authenticated;
-- role, id, created_at, and every other column can now only ever be changed
-- via the service-role client (which every legitimate role-changing code
-- path — signUp, switchActiveRole, adminApproveDriver, etc. — already uses).

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. driver_profiles.status — remove the driver self-update policy entirely
-- ═══════════════════════════════════════════════════════════════════════════
-- Confirmed no legitimate code path needs this: is_online and notification
-- preference updates already go through server actions using the admin
-- client (app/actions/driver.ts). Status may only ever be set by admin
-- approval/rejection (also admin client) or the pending-review upsert.
drop policy if exists "Driver can update own profile" on driver_profiles;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. delivery_requests — remove driver-side UPDATE policies
-- ═══════════════════════════════════════════════════════════════════════════
-- Every legitimate driver mutation now goes through server actions using
-- the admin client with their own explicit ownership/status checks
-- (acceptDelivery, updateDeliveryStatus, markParcelCollected,
-- verifyDeliveryOtpAndComplete all already do this). No direct client
-- write path to this table should exist for drivers at all — mirrors the
-- INSERT lock-down from scripts/026_payment_before_dispatch.sql.
drop policy if exists "Driver can claim available delivery" on delivery_requests;
drop policy if exists "Driver can update assigned deliveries" on delivery_requests;
drop policy if exists "Driver can update assigned or claim open deliveries" on delivery_requests;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. wallet_balances — remove the self-update and unscoped "service role" policies
-- ═══════════════════════════════════════════════════════════════════════════
-- No legitimate direct-client write path exists — every balance change
-- goes through create_delivery_with_wallet_payment(), credit_wallet_topup(),
-- cancel_delivery_order() (all SECURITY DEFINER, row_security = off), or the
-- admin client. This policy let a customer set their own balance to
-- anything via a direct browser call.
drop policy if exists "User updates own wallet" on wallet_balances;
-- Missing `to service_role` meant this applied to EVERY authenticated
-- client, not just the service role (which bypasses RLS and never needed
-- this policy in the first place).
drop policy if exists "Service role wallet" on wallet_balances;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. wallet_transactions / chat_sessions / chat_messages / notifications
--    — same unscoped "service role" policy bug
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists "Service role wallet_tx" on wallet_transactions;
drop policy if exists "Service role sessions" on chat_sessions;
drop policy if exists "Service role messages" on chat_messages;
drop policy if exists "Service role can insert notifications" on notifications;
-- The DB trigger that writes notifications (notify_delivery_change) is
-- itself SECURITY DEFINER with row_security = off, and every application
-- code path that inserts notifications directly (e.g. cancel_delivery_order)
-- uses the admin client — neither ever depended on this policy.

-- Notifications UPDATE also had no WITH CHECK, letting a user reassign
-- their own notification row to a different user_id.
drop policy if exists "Users can update own notifications" on notifications;
create policy "Users can update own notifications"
  on notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. customer_locations — scope driver/admin read access properly
-- ═══════════════════════════════════════════════════════════════════════════
-- Was `using (true)` — readable by ANY authenticated client, not just a
-- driver actively delivering to that customer. Mirrors the correctly-scoped
-- "customers read assigned driver location" policy on driver_locations
-- (scripts/007_driver_live_locations.sql).
drop policy if exists "drivers read customer locations" on customer_locations;

create policy "drivers read assigned customer location"
  on customer_locations for select
  using (
    exists (
      select 1 from delivery_requests d
      where d.customer_id = customer_locations.customer_id
        and d.driver_id = auth.uid()
        and d.status in ('accepted', 'collected', 'in_transit', 'picked_up')
    )
  );

create policy "admins read all customer locations"
  on customer_locations for select
  using (exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. delivery_status_logs — scope INSERT to the driver's own delivery
-- ═══════════════════════════════════════════════════════════════════════════
-- Was only `with check (auth.uid() = updated_by)` — any authenticated user
-- could insert a fabricated log row against ANY delivery, not just one
-- they're actually assigned to.
drop policy if exists "Driver can insert delivery logs" on delivery_status_logs;
create policy "Driver can insert delivery logs"
  on delivery_status_logs for insert
  with check (
    auth.uid() = updated_by
    and exists (
      select 1 from delivery_requests d
      where d.id = delivery_status_logs.delivery_id and d.driver_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. driver-documents storage bucket — restore folder scoping, narrow SELECT
-- ═══════════════════════════════════════════════════════════════════════════
-- scripts/006_fix_storage_rls.sql accidentally dropped the folder-ownership
-- check that scripts/004_storage_and_documents.sql originally had, letting
-- any authenticated user upload/overwrite/delete ANY other user's ID
-- documents, selfies, or delivery photos in this bucket. It also made the
-- bucket fully public (no auth required to read).
drop policy if exists "Driver can upload own documents" on storage.objects;
drop policy if exists "Driver can update own documents" on storage.objects;
drop policy if exists "Driver can delete own documents" on storage.objects;
drop policy if exists "Public can read driver documents" on storage.objects;

create policy "Driver can upload own documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'driver-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Driver can update own documents"
  on storage.objects for update to authenticated
  using (bucket_id = 'driver-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'driver-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Driver can delete own documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'driver-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Narrowed from fully public to "must be logged in" — these are ID
-- documents, selfies, and delivery photos, not content that should be
-- readable by an unauthenticated request with just the URL. A driver's own
-- folder, any admin, and any customer viewing their own delivery's photos
-- via the app all remain able to see what they need to (the app never
-- restricted reads by folder — only writes needed that scoping).
create policy "Authenticated can read driver documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'driver-documents');

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. create_delivery_with_wallet_payment() — atomic promo usage-limit check
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. cancel_delivery_order() — atomic cancellation (refund/fee + status flip)
-- ═══════════════════════════════════════════════════════════════════════════
-- Replaces the multi-step, non-atomic cancellation previously done directly
-- in app/actions/wallet.ts (read status → maybe refund → flip status, as
-- separate un-synchronized calls). Concurrent cancel calls on the same
-- order could each read "still cancellable" before either had flipped the
-- status, and each independently credit the refund — free money, repeatable
-- on any order. Locking the delivery row up front serializes this.
create or replace function cancel_delivery_order(
  p_delivery_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_customer_id uuid := auth.uid();
  v_delivery record;
  v_free_cancel boolean;
  v_deduction_amount numeric;
  v_refund_amount numeric := 0;
  v_cancellation_fee numeric := 0;
  v_distance_miles numeric := 0;
  v_label text;
begin
  if v_customer_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_delivery
  from delivery_requests
  where id = p_delivery_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if v_delivery.customer_id <> v_customer_id then
    raise exception 'not_your_order';
  end if;
  if v_delivery.status in ('delivered', 'cancelled') then
    raise exception 'cannot_cancel';
  end if;

  v_label := coalesce('#' || v_delivery.tracking_number, '#' || upper(substring(p_delivery_id::text, 1, 8)));
  v_free_cancel := v_delivery.status in ('requested', 'accepted');

  if v_free_cancel then
    select amount into v_deduction_amount
    from wallet_transactions
    where delivery_id = p_delivery_id and type = 'deduction'
    limit 1;

    if v_deduction_amount is not null then
      v_refund_amount := abs(v_deduction_amount);
      insert into wallet_balances (user_id, balance, updated_at)
      values (v_customer_id, v_refund_amount, now())
      on conflict (user_id) do update
        set balance = wallet_balances.balance + v_refund_amount,
            updated_at = now();
      insert into wallet_transactions (user_id, type, amount, description, delivery_id)
      values (v_customer_id, 'cashback', v_refund_amount, 'Refund for cancelled order ' || v_label, p_delivery_id);
    end if;
  else
    if v_delivery.pickup_lat is not null and v_delivery.pickup_lng is not null
       and v_delivery.delivery_lat is not null and v_delivery.delivery_lng is not null then
      v_distance_miles := 3958.8 * 2 * asin(least(1, sqrt(
        power(sin(radians(v_delivery.delivery_lat - v_delivery.pickup_lat) / 2), 2) +
        cos(radians(v_delivery.pickup_lat)) * cos(radians(v_delivery.delivery_lat)) *
        power(sin(radians(v_delivery.delivery_lng - v_delivery.pickup_lng) / 2), 2)
      )));
      v_cancellation_fee := ceil(v_distance_miles);
    else
      v_cancellation_fee := 5;
      v_distance_miles := 0;
    end if;

    insert into wallet_balances (user_id, balance, updated_at)
    values (v_customer_id, -v_cancellation_fee, now())
    on conflict (user_id) do update
      set balance = wallet_balances.balance - v_cancellation_fee,
          updated_at = now();

    insert into wallet_transactions (user_id, type, amount, description, delivery_id)
    values (
      v_customer_id, 'cancellation_fee', -v_cancellation_fee,
      'Cancellation fee for order ' || v_label || ' (' || round(v_distance_miles::numeric, 1) || ' miles x GBP1)',
      p_delivery_id
    );
  end if;

  update delivery_requests
  set status = 'cancelled', cancelled_by = 'customer'
  where id = p_delivery_id;

  insert into notifications (user_id, title, body)
  values (
    v_customer_id,
    case when v_free_cancel then 'Order Cancelled' else 'Order Cancelled — Fee Applied' end,
    case
      when v_free_cancel and v_refund_amount > 0 then
        'Your order has been cancelled and GBP' || to_char(v_refund_amount, 'FM999999990.00') || ' was refunded to your wallet.'
      when v_free_cancel then
        'Your order has been cancelled at no charge.'
      else
        'Your order was cancelled. A GBP' || v_cancellation_fee || ' cancellation fee was deducted from your wallet.'
    end
  );

  return jsonb_build_object(
    'freeCancel', v_free_cancel,
    'cancellationFee', v_cancellation_fee,
    'distanceMiles', v_distance_miles,
    'refundAmount', v_refund_amount
  );
end;
$$;
