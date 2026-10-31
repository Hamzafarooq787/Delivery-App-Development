# Remaining admin repairs: batches 4–12

## Delivered scope

| Area | Changes |
| --- | --- |
| Finance and reconciliation | Full-record aggregate reports, date filters, safe CSV exports, separate shopping purchase funds, known/unknown processing costs, payment reconciliation and missing-record attention flags. Recorded driver earnings and confirmed bank payments are distinct. |
| Customer records | Paginated customer history, orders, payments, refunds, receipts, shopping times, support and addresses. Suspend/archive preserves history and protects active jobs. |
| Operational settings | Booking/service switches, opening hours and holidays, postcode/geographic restrictions, driver mileage/time floors, van compensation and cancellation policies. Existing pricing controls remain available. |
| Permissions and evidence | Scoped staff access, optional administrator MFA, database policy enforcement and a private audit history recording actors, reasons and changes. |
| Driver verification | Persistent document decisions and reasons, current-document approval checks, safe existing-account onboarding and password invitations for new accounts. |
| Orders and recovery | Atomic suitable-driver assignment, payment checks, recovery cases, returned-order cancellation, dedicated shopping-card closure checks and idempotent agreed driver compensation. Refunds require their separate finance action. |
| Waiting charges | Customer-approved normal-collection waiting checkout, verified Stripe completion, duplicate protection, earned-payment statements and cancellation refund handling. No automatic shopping-time charge. |
| Maps and integrations | Assignment-specific GPS freshness, reconnect/refetch cleanup, integration health and authenticated cron health. Durable failed email/push records support consent-aware retries. |
| Navigation and scale | Server-side pagination/search/filtering, audit/search/help/security pages, linked records and working header controls. Customer/driver identity remains independent of the active dashboard mode. |

## Verification

- 159 automated regression tests passed, including database-compatible transaction, permission and policy tests plus action, provider-response and map lifecycle tests.
- Production build, TypeScript, 172 icon-name checks and whitespace validation passed.
- Test databases contain synthetic fixtures only. No live customer charge, refund, bank payout, message, invitation or document approval was used as a test.
- Apply `20261031193847_admin_remaining_batches.sql` before deploying this code. Verify live schema, privileges, report queries and existing record counts after application.

## Acceptance boundaries

- Before release the live database had 20 orders, 19 paid payment records and one driver-earning record. Historical missing records require real provider/accounting evidence; this migration does not fabricate earnings or mark payouts paid. The attention queue exposes these gaps.
- There are no connected driver bank accounts and automatic bank payouts are disabled. Stripe Connect KYC, actual bank payout acceptance and provider reconciliation remain external acceptance work.
- Actual-device GPS/browser permission tests and real Stripe waiting-payment/refund and shopping-card merchant-return tests remain unverified. Automated tests cover their validation and transaction logic.
- MFA remains optional by default. An owner enabling the requirement must verify their own second factor first. Existing administrator accounts retain owner access; newly added staff receive explicit scopes.
- The audit and dispatch tables intentionally have RLS enabled without browser policies. They are server-only. Existing leaked-password protection requires a Supabase plan feature and is not silently enabled through a paid upgrade.
- Net contribution is provisional before other operating costs, not final accounting profit. Missing provider costs are shown as unknown.

## Live database results

The migration applied successfully. Read-only checks retained 20 orders, 19 paid payments and one earnings record. Browser writes to orders/payments and browser reads of the audit log are denied; the scope predicate is private. The live finance report identifies one missing-payment order and two missing-earnings orders. No new public privileged RPC warnings appeared. The two new server-only tables account for the expected additional RLS-without-policy informational notices.

