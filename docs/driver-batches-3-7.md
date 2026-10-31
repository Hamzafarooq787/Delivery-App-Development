# Driver batches 3–7

## Delivered scope

### Batch 3 — verification

- Vehicle-specific document requirements are shared by the client and server: bicycle-only drivers need identity/selfie; motor vehicles also need insurance/registration.
- Draft and submitted applications are separate. A submission timestamp is written transactionally after current required documents are checked. Admin queues show submitted applications, not every partial upload.
- Insurance expiry is required on new uploads/review. Other documents can have an expiry date. Expired required documents cannot be submitted/approved or used to claim a new job.
- Existing active jobs are not cancelled or locked out by document expiry. Daily compliance checks use the existing authenticated cron and send deduplicated in-app reminders. Expired accounts move to pending/offline after their active work finishes. Existing approved documents with unknown expiry are not silently assigned invented dates; dates must be supplied when replaced/reviewed.
- Admin document views show expiry dates. Review changes continue to preserve the atomic replacement and evidence protection from batches 1–2.

### Batch 4 — shopping and contact

- Buy for Me has a lazy-loaded live map, shop/customer navigation, and the existing authorized call/message component.
- Unavailable products can be corrected before purchase authorization. The existing database freeze still prevents changes after purchase authorization; financial approval guards are retained.
- The Collect & Deliver customer card loads contact details through an assigned-driver, active-order server action. Customer email is not exposed by that lookup.

### Batch 5 — earnings and payout visibility

- Job detail and active-job cards display the saved driver earning quote rather than the customer's service fee.
- A service-only SQL snapshot calculates totals over the full ledger, merges legacy missing earnings once, and pages history in 20-row batches. Reserved/paid earnings are not shown as available again.
- Daily/weekly/monthly boundaries and dates use Europe/London independently of the device/database timezone. Dashboard totals use the same server snapshot.
- Bank status distinguishes disconnected, more information needed, verified and provider error. Automatic-payout status is displayed separately. Returning from Stripe is not treated as verification.
- Existing weekly reservation, bank worker, reconciliation and retry tests remain in the regression suite. **Real Connect/KYC and bank payouts are not completed:** live read-only checks found no linked driver bank accounts and automatic payouts remain disabled. These cannot be represented as verified transfers.

### Batch 6 — jobs and support

- Job lists and details refresh while visible and on focus. Available/completed/active histories have server pagination, counts and search. Failed queries are shown as errors rather than empty successful lists.
- Header search and Help links are functional. A driver-only search page reads only that driver's assigned job history.
- Support tickets return the real stored ID, open the existing authenticated reply thread, and have paged history and visible retry states. Pending drivers can access the support chat; chat initialization/sending failures are handled and stored unread counts are loaded.
- A driver error boundary provides a recovery button without exposing raw database errors.

### Batch 7 — performance and waiting consent

- Dashboard reads only active jobs and a bounded offer page. Earnings aggregates stay in SQL. Driver history, earnings, payouts and document lookup indexes support the common filters. Shopping maps stay dynamically loaded.
- Maps Directions parameters are encoded, including addresses containing `&`, and oversized address inputs are rejected.
- Collection waiting has a server-timed start, 5 free minutes, proportional requests, a 60-billable-minute cap, an optional admin rate (0/absent disables requests), and explicit customer approve/decline. Buy for Me is excluded.
- Admin can see the amount/rate/decision. **Waiting requests do not debit a card, change booking prices or credit driver earnings.** Customer approval sends the request for admin review. Automated extra-fee collection and the corresponding refund/earnings settlement are not implemented or claimed complete here.
- Physical iPhone/Android/background GPS and real purchase-card/bank acceptance tests remain unverified. No universal device or measured speed guarantee is claimed.

## Verification

- 111 regression tests passed, including actual PostgreSQL-compatible RLS/transaction tests and component/server-action checks.
- Tests include incomplete/current/expired verification, bicycle requirements, admin authorization, reminder deduplication, protected active jobs, 1,205 earnings rows, no duplicate legacy earnings, reserved-fund availability, UK date boundaries, waiting consent/no debit, real ticket IDs and bank readiness states.
- TypeScript, icon validation and clean production build passed. TypeScript was rerun after the build because moving generated build types while an earlier check was running invalidated that check; the successful final check is the recorded result.
- Live migration applied. Read-only live checks confirmed all three columns, bounded finance results for existing drivers, service-only RPC privileges, no linked bank accounts, and disabled automatic payouts.
- Security-advisor counts are unchanged from the pre-migration baseline. No new warnings.
- No real driver applications were submitted/approved, no expiry reminders were triggered manually, and no real customer orders, purchases, messages, payments or payouts were created during testing.

## Remaining launch gates

1. Drivers complete Stripe Connect and KYC. Verify provider/webhook configuration and a controlled real payout/return before enabling automatic transfers.
2. Implement and verify waiting-fee Stripe collection, cancellation/refunds and earnings settlement before treating waiting approvals as payable charges.
3. Run physical-device and real shopping-card acceptance tests. Fix any resulting device/provider issues before claiming full end-to-end launch verification.
