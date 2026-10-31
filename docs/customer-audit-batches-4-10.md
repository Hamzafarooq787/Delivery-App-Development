# Customer audit — Batches 4–10

## Delivered repairs
| Batch | Changes |
|---|---|
| 4 | Driver/customer phone links and order conversations, with assigned-order access checks and idempotent message submission. Route-based arrival estimates distinguish arrival at pickup from delivery, prefer traffic duration, and disappear on stale GPS. Tracking shows load failures and retry, resets old order data, and refreshes through realtime with a visible-page fallback. |
| 5 | Customer-scoped server pagination with stable ordering and bounded page sizes. Monthly gross charges include subsequently refunded payments; refund totals count completed card refunds and actual wallet refund transactions. Wallet shopping charges include prepaid shopping funds. History refreshes while visible and on realtime/focus. |
| 6 | Wallet return verification checks Stripe ownership, type, currency, amount and the exact credited wallet transaction. URL flags alone never produce payment success. Confirmation polling survives URL cleanup and has bounded retries. Checkout confirms automatically; card cancellation copy says refund requested to original card, rather than promising a wallet credit. |
| 7 | Explicit Start/Stop location sharing, exact-job driver read policy, 45-second expiry, active owned-order validation and ordered clear after pending location updates. Saved address selectors in both forms; address management stores selected coordinates and ignores outdated GPS callbacks after typing, editing or closing. Older text-only saved addresses require a confirmed map location. |
| 8 | Customer and admin reply in the same ticket; original requests remain intact. Atomic appends prevent lost replies and duplicate retries. Customer replies reopen resolved tickets. Both views refresh ticket status and conversations. |
| 9 | Authenticated profile validation plus a database trigger for direct permitted profile updates. Trimmed names, sensible phone formats, visible load errors/retry and protected saves. Network failures release profile/password/preference busy states. |
| 10 | Customer home refreshes status, balance and profile through authenticated realtime with a visible fallback. Abandoned photos are cleaned only after reference checks and checkout leases; paid/pending-order photos, receipts and replacement evidence are protected. Removed outdated automatic-draft recovery promises. |

## Database and file safety
`supabase/pending-customer-batches-4-10.sql` is additive and uses existing tables. It adds thread arrays on orders/tickets and photo leases on users, with server-only security-invoker RPCs. Browser clients cannot modify photo leases or forge support replies during ticket insertion. Checkout and cleanup serialize on the same user row; deletion claims reject subsequent checkout, and existing checkout leases reject cleanup. Storage metadata is read-only; physical deletion uses Storage API. Aborted close requests are recovered by a guarded sweep of item-upload folders older than 48 hours (one database call, at most twenty deletions). Nothing in this migration deletes existing photos or moves money.

## Verification
- 76 automated checks: the existing 64 plus 12 new tests. New PostgreSQL execution covers thread ownership, terminal-order denial, idempotency, support reopen, server page boundaries, full-history financial totals, completed versus pending refunds, wallet refunds, checkout/cleanup exclusion, immutable pending payment references, profile constraints and browser RPC privileges.
- Wallet server tests reject anonymous, foreign, forged, wrong-currency and wrong-amount sessions. A paid session remains pending until its exact ledger credit exists. Verification never credits funds.
- Browser QA runs the actual components with test services. One double-click creates one message; the reply appears; saved coordinates select correctly and legacy text-only addresses show guidance. Checkout progresses from processing to tracking confirmation automatically. Simulated GPS has zero watchers until Start, one watcher after Start and one clear after Stop.
- Actual payment components paginate at desktop and mobile sizes. The 320px page and 430px payment dialog have no horizontal overflow (320/320 and 390/390 client/scroll width).
- TypeScript, icon validation and production build pass. Live migration, server-only ACLs and the empty customer payment query passed separately from mocked browser services.

## Remaining external requirement
Supabase organization `vercel_icfg_Bc1rnNhRWr5MVX2EkXvJIl32` is confirmed Free. Supabase's native leaked-password protection requires Pro or above; the security advisor still reports it disabled. No paid plan change was made. Enable it after upgrading in Auth password settings: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . This item is not marked complete.

Real Stripe charges, refunds and bank transfers; actual phone calls; actual driver/customer messages in production; push delivery; and physical iPhone/Android GPS were not exercised. Browser services are fixtures and do not represent real end-to-end payment or device certification.
