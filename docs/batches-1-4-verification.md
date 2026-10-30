# Batches 1–4: repair handoff

Branch: codex/batches-1-4-repairs. Baseline: b51e2a67f42edf856cebeb3322d02cd24e5f27fd.

## What changed

- Internal notification senders moved to a server-only module. Public server actions now only manage the caller's device tokens.
- Driver document queries require owner/admin identity. Sensitive document viewing uses an authenticated, short-lived redirect. Delivery proofs use a separate order-authorized route so making the bucket private does not break legitimate proof viewing.
- Shopping mutations check assignment and active shopping state. Substitution references are checked against their order. Reads require order participation/admin identity.
- Historical orders no longer authorize current driver location reads. Available jobs reject anonymous callers.
- One normalizer reads canonical enabled or the legacy service_enabled setting. Failed settings reads stop booking instead of enabling a default service.
- Shopping validation checks product count, quantities, price values and coordinates. Five products are enforced in the UI. A technical quantity ceiling of 99 prevents unbounded input; it is not a client-approved vehicle/weight policy.
- Customer photos and driver receipts now use the user-scoped storage paths required by existing policies.
- Booking uses a stable per-form request key and a single service-only transaction for order, items, service fee and goods hold. Retrying returns the same order.
- Receipt settlement validates finite non-negative totals and receipt association, checks the uploaded object, and settles once in a row-locked transaction. Purchase completion cannot bypass receipt settlement.
- Cancellation returns a funded unused shopping hold once. Shopping already in progress requires reconciliation rather than guessing whether goods were purchased. Existing customer cancellation excludes shopping-hold debits from its service-fee refund selection.
- TypeScript checking is enabled for builds. Added CI typecheck/repair-test/icon/build checks and fixed the existing synchronous route-params type error on the public tracking page.

## Verification

Local focused suite: six tests passed. It includes actual PostgreSQL execution in PGlite against an isolated fixture: repeated booking, insufficient funds, item-write failure rollback, negative totals, wrong driver, unresolved items, pending substitutions, repeated settlement, changed settlement rejection, goods-hold cancellation and service-only function grants. Permission action tests cover anonymous document/substitution reads, unrelated item mutation, receipt-free purchase completion and historical tracking access.

TypeScript and focused ESLint passed before final packaging. Icon-name check passed. Build status is recorded in the accompanying checklist update; a placeholder Supabase URL/key is used only for build checking, not as an application environment.

## Important blockers: not production verified

The connected Supabase account lists two unrelated projects and no GoDrop project. No live SQL, bucket change, advisors or query verification was possible. No authenticated customer/admin/driver session or Stripe transaction was used. The exact cause of the user's live failed booking remains unconfirmed.

The migration intentionally fails before modifying anything permanently if shopping_items, shopping_substitutions or bfm_settings are missing. Recover and compare their actual baseline first. It adds columns/functions to existing tables; it does not invent a replacement shopping schema. It revokes direct customer/driver access to shopping tables in favour of authorized actions. Check all consumers before rollout.

Apply and test the migration in staging BEFORE deploying this branch, since booking and settlement now depend on the new functions. Do not merge/deploy this branch alone. Review grants, policies, legacy shopping RPC exposure and existing triggers. Back up first. Live database verification and physical-device acceptance remain open.

Audit correction: script 018 already contains a driver-cancellation service-fee cashback trigger. The previous broad claim that all driver cancellations lack refunds was too strong. What remains is shopping-hold reconciliation, trigger deployment verification and exact-once settlement across all cancellation paths.

Still open within batches 1–4: actual GoDrop schema discovery; exact live submission root cause; live bucket/RLS/migration tests; legacy shopping holds and historical settlement reconciliation; authenticated end-to-end booking/proof viewing and mobile UI tests. Full driver payout/admin refund redesign and launch pricing/direct payments belong to later batches. No batch should be marked production-complete from these local tests.

## Follow-up after access was restored (31 October 2026, Pakistan time)

GoDrop project ozjrdyrxmrgpzyausuyx was inspected. Existing shopping tables and RPC are present; enabled=true, max spend=50, percentage=10. There are 20 orders and no shopping orders at inspection. Driver-documents is public. No shopping error appeared in the available 24-hour Postgres log window, so the exact reported submission cause is not established.

The proposed migration plus booking/retry/settlement assertions executed successfully against the real database in one rolled-back transaction. No test changes were persisted. The migration was adjusted to retain shop_lat/shop_lng and the actual service_type convention. Privacy activation is now a separate migration to run only after the new viewing routes are live.
