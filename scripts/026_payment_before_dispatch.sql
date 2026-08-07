-- 026_payment_before_dispatch.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Payment Before Dispatch — close a real gap where a customer's own browser
-- session (anon key + their JWT) could call
--   supabase.from('delivery_requests').insert({ customer_id: <self>, ... })
-- directly, completely bypassing createDeliveryRequest() and the atomic
-- wallet-payment RPC, and land an unpaid row with status = 'requested' that
-- was immediately visible and acceptable to drivers.
--
-- The only legitimate way to create a delivery is now the SECURITY DEFINER
-- function create_delivery_with_wallet_payment() (scripts/024_...sql), which
-- runs with `row_security = off` and is therefore completely unaffected by
-- this policy change — payment still happens atomically with row creation.
--
-- Run in the Supabase SQL editor.

drop policy if exists "Customer can create delivery" on delivery_requests;

create policy "Customers cannot insert delivery requests directly"
  on delivery_requests for insert
  with check (false);
