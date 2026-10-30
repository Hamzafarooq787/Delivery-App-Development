# Batches 11–14: implementation for the combined test

31 October 2026 (Pakistan time). The authoritative task file does not contain the original numbered grouping for batches 11–14. This continuation uses the stated grouping: 11 payouts/refunds; 12 admin reporting/settings; 13 notifications/chat; 14 scheduling/public-map safeguards/branding. Do not represent this inferred grouping as a recovered original plan.

## Prepared changes

- 11: exact earning claims and payout creation in one transaction; reserved versus paid; rejection releases exact claims; historical unlinked payouts require reconciliation; an admin-recorded bank reference is required before marking a linked payout paid. Bulk fake-paid action removed. A Monday 08:00 UTC cron prepares requests only. Original-card refunds stay on their existing workflow; legacy wallet manual refunds and cancellation use locked, capped, idempotent transactions. Unsettled shopping funds cannot be manually refunded as service fees.
- 12: authoritative payments/refunds and separate payout states/references; database report totals and payout totals without API row truncation; payment and payout lists paginate. Actual 30-day periods, prior-period order count, ranked drivers and explicit read failures replace fabricated growth/fallback values. Platform settings are separate from admin identity and consumed on support pages. Shopping item prices/photos, approval decisions and stage/problem history are visible. Settings changes record before/after values and actor metadata. A limited Needs Attention view covers unresolved shop reports, pending substitutions and failed/action-required refunds; it is not a complete monitoring system.
- 13: account-level push preferences enforced by the sender, driver delivery-alert switches enforced, protected admin push title/enabled settings with history, unsupported delivery email/SMS controls removed. Chat opens the newest page and offers earlier messages using a timestamp+ID cursor. Driver send errors preserve the text; no fabricated support-online claim.
- 14: overnight busy rules use the starting weekday in Europe/London, with DST tests. Anonymous reverse geocoding validates coordinates/result types, has a bounded provider timeout and database-backed limits (10 requests/client/minute, 60 total/minute). No raw IP is stored. Legacy public product branding corrected without claiming legal approval. Existing TypeScript CI remains mandatory; new tests join the repair check command.

## Required before merge / production

`supabase/pending-batches-11-14.sql` is a pending SQL change set, not an applied migration. It extends existing tables only. Finalize its migration history through the connected migration API during release; do not run CLI db push against unreconciled history. Current production remains PR171 until this change is merged and deployed.

17 automated test groups passed, including payout insertion rollback, reservation replay, rejection release, immutable paid reference, refund rollback/replay/caps, database totals above 1,000 records, function grants, rate limits and London overnight/DST boundaries. TypeScript passed. Full signed-in/customer/driver/admin/device acceptance is deliberately deferred to the combined test requested by the user. No real charge, transfer or bank payout was made. Database syntax was checked in a rolled-back transaction against GoDrop, not persisted.

## Still open — do not claim all batches fully complete

- Automatic provider-to-bank payout execution is NOT implemented. Weekly cron reserves requests only; admin payment recording attests an externally completed transfer. Connect/onboarding, transfer idempotency, connected-account payout webhooks, bank failure/reversal reconciliation and live provider acceptance remain necessary for fully automatic weekly bank payouts.
- Historical paid earnings without a linked payout need ledger reconciliation; this change does not reset or pay historical records blindly.
- Chargeback/dispute reconciliation, full financial reconciliation and launch-approved legal/driver agreement copy remain open. Branding correction is not legal review.
- Attention queue does not yet cover stale GPS, missing receipts, failed bookings or payout-provider failures. Full structured shop-problem resolution remains open.
- Admin shopping timeline captures stages/problems; substitution decisions retain their own decision timestamps. Service-role updates cannot claim a human auth.uid actor; driver identity is recorded separately.
- Email/SMS delivery adapters and templates are not implemented; UI states this honestly.
- Earlier external Issuing setup, real payment/refund/device tests, normal collection waiting-charge consent and launch service boundary selection remain open.

Keep source implementation, automated checks and production acceptance separate in the task file. Run the combined role/device/provider test after the remaining implementation and provider setup, and fix its findings before declaring completion.
