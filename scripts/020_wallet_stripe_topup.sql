-- 020_wallet_stripe_topup.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Stripe-backed wallet top-ups: idempotent crediting.
-- Run in the Supabase SQL editor.
--
-- Stripe can deliver the same webhook event more than once (retries,
-- duplicate delivery). For delivery payments this is harmless — re-setting
-- payments.status = 'paid' twice is a no-op. For wallet top-ups it is NOT
-- harmless: crediting the balance twice would give the customer free money.
--
-- credit_wallet_topup() below logs the transaction AND credits the balance
-- in a single Postgres function call, so both happen in one transaction —
-- either both succeed or (on any error) both roll back and the webhook
-- returns 500 so Stripe retries the whole thing safely. This avoids a gap
-- where the transaction row is logged but the balance credit is lost (e.g.
-- the webhook process crashes between two separate calls) — a later retry
-- would then see "already logged" and skip crediting forever.

alter table public.wallet_transactions
  add column if not exists stripe_session_id text;

create unique index if not exists wallet_tx_stripe_session_unique_idx
  on public.wallet_transactions (stripe_session_id)
  where stripe_session_id is not null;

-- Atomically logs the top-up transaction and credits the balance.
-- Returns true if this call actually credited the balance (first time
-- seeing this stripe_session_id), false if it was already processed
-- (safe to call repeatedly — Stripe webhook retries rely on this).
create or replace function credit_wallet_topup(
  p_user_id uuid,
  p_amount numeric,
  p_stripe_session_id text,
  p_description text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count int;
begin
  insert into wallet_transactions(user_id, type, amount, description, stripe_session_id)
  values (p_user_id, 'topup', p_amount, p_description, p_stripe_session_id)
  on conflict (stripe_session_id) where stripe_session_id is not null do nothing;

  get diagnostics v_row_count = row_count;

  if v_row_count = 0 then
    -- Already processed this Stripe session — do not credit again.
    return false;
  end if;

  insert into wallet_balances(user_id, balance, updated_at)
  values (p_user_id, p_amount, now())
  on conflict (user_id) do update
    set balance = wallet_balances.balance + p_amount,
        updated_at = now();

  return true;
end;
$$;
