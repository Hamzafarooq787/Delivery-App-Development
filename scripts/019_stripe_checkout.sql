-- 019_stripe_checkout.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Stripe Checkout integration: reconciliation columns on the payments table.
-- Run in the Supabase SQL editor.
--
-- payments.stripe_payment_intent already exists (001_create_schema.sql).
-- This adds:
--   stripe_session_id — Stripe Checkout Session id (cs_...) recorded when the
--                       customer starts checkout, used by the webhook and for
--                       support/reconciliation
--   paid_at           — timestamp when the webhook confirmed the payment

alter table public.payments
  add column if not exists stripe_session_id text,
  add column if not exists paid_at timestamptz;

-- Fast webhook lookups by session / intent
create index if not exists payments_stripe_session_id_idx
  on public.payments (stripe_session_id);

create index if not exists payments_stripe_payment_intent_idx
  on public.payments (stripe_payment_intent);

-- One payment row per delivery — createCheckoutSession() relies on this.
-- Dedupe first so the index can build: prefer paid/released rows, then newest.
delete from public.payments
where id in (
  select id from (
    select id,
           row_number() over (
             partition by delivery_id
             order by (status in ('paid', 'released')) desc, created_at desc
           ) as rn
    from public.payments
  ) ranked
  where ranked.rn > 1
);

create unique index if not exists payments_delivery_id_unique_idx
  on public.payments (delivery_id);
