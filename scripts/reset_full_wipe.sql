-- reset_full_wipe.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️⚠️⚠️  DESTRUCTIVE — DELETES EVERY ROW OF DATA AND EVERY ACCOUNT  ⚠️⚠️⚠️
--
-- This is NOT one of the numbered migrations and never runs automatically.
-- Run it only when you deliberately want to wipe Go Drop back to a
-- completely empty state (e.g. clearing demo/test data before a real
-- launch). This CANNOT be undone — do not run it against real customer or
-- driver data.
--
-- What this does:
--   1. Empties every table in the public schema (orders, drivers, ratings,
--      payments, chats, notifications, promo codes, everything). Table
--      STRUCTURE is untouched — only the data is removed.
--   2. Deletes every Supabase Auth login (auth.users) — including whichever
--      admin account you're using right now to run this script. You'll be
--      signed out, and need to sign up again afterward (see note below).
--   3. Re-seeds the handful of single-row settings tables (surge pricing,
--      automatic discounts, re-engagement reminders) back to their
--      original defaults, all switched off — exactly as they were on day
--      one, so the app doesn't break from a missing settings row.
--
-- Run this in the Supabase SQL editor.

begin;

truncate table
  addresses,
  automatic_discounts,
  busy_period_rules,
  chat_messages,
  chat_sessions,
  customer_locations,
  customer_profiles,
  delivery_otps,
  delivery_requests,
  delivery_status_logs,
  disputes,
  driver_documents,
  driver_earnings,
  driver_locations,
  driver_profiles,
  driver_vehicles,
  marketing_campaign_recipients,
  marketing_campaigns,
  notifications,
  payment_methods,
  payments,
  payouts,
  promo_code_redemptions,
  promo_codes,
  proof_uploads,
  ratings,
  reengagement_sends,
  reengagement_settings,
  support_tickets,
  surge_pricing_settings,
  user_notification_tokens,
  users,
  wallet_balances,
  wallet_transactions
restart identity cascade;

-- Re-seed the singleton settings rows the app expects to always exist.
insert into surge_pricing_settings (id) values (true) on conflict (id) do nothing;
insert into reengagement_settings (id) values (true) on conflict (id) do nothing;
insert into automatic_discounts (type, active, discount_type, discount_value, max_discount_amount, loyalty_order_threshold)
values
  ('first_order', false, 'percentage', 15, 10, null),
  ('loyalty',     false, 'percentage', 10, 10, 5)
on conflict (type) do nothing;

-- Wipe every login account, including your current admin session.
delete from auth.users;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- After running this:
--   1. Go to the app and sign up a brand new account (this becomes a
--      'customer' by default, same as any normal signup).
--   2. Back in the Supabase SQL editor, run:
--        update public.users set role = 'admin' where id =
--          (select id from auth.users where email = 'your-email@example.com');
--      to promote that account to admin.
-- ─────────────────────────────────────────────────────────────────────────────
