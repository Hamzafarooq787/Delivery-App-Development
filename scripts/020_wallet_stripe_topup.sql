-- 020_wallet_stripe_topup.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Stripe-backed wallet top-ups: idempotency column for wallet_transactions.
-- Run in the Supabase SQL editor.
--
-- Stripe can deliver the same webhook event more than once (retries,
-- duplicate delivery). For delivery payments this is harmless — re-setting
-- payments.status = 'paid' twice is a no-op. For wallet top-ups it is NOT
-- harmless: crediting the balance twice would give the customer free money.
--
-- stripe_session_id + a unique index makes the webhook idempotent: the first
-- delivery inserts the transaction row and credits the balance; any replay
-- fails the unique insert and is skipped before the balance is touched.

alter table public.wallet_transactions
  add column if not exists stripe_session_id text;

create unique index if not exists wallet_tx_stripe_session_unique_idx
  on public.wallet_transactions (stripe_session_id)
  where stripe_session_id is not null;
