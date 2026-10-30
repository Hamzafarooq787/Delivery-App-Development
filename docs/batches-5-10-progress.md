# Batches 5–10: repair rollout, remaining scope

This release is a **partial implementation of the six requested batches**, not completion of batches 5–10. Do not close a batch solely because the build deploys.

Implemented:
- Address HTTP/provider failures surface as errors; UK/Manchester default search bias; shopping map-pin selection with reverse-geocoded confirmation.
- Unrounded driving mileage reaches pricing. Existing surge settings store now persists £4.49 first two miles, £1.20/additional mile and fixed £3.99 shopping fee. Admin can edit these plus explicit size/van/weather additions and Manchester radius. Radius defaults to 0 (existing unrestricted coverage); no invented business boundary. Existing shopping cap remains unchanged and can be raised by admin.
- Server-signed 10-minute customer quote consent rejects changed/expired prices before a wallet charge. This is not direct checkout.
- Shopping decisions lock the parent order and cannot be reversed after recording. Driver UI checks mutation errors before showing success. Shopping tracking links use the valid route.
- Driver approval/checklist, online approval, vehicle capability on acceptance and admin assignment, payment filtering on available jobs, preserved approval on secondary-role creation, forward-only status changes and pre-collection safety release. Job offer currency is GBP and shows the existing 75% earnings calculation; desired 80% plus a minimum needs the earnings/payout work.
- Tracking remains mounted across driver pages, recorded GPS age controls freshness, cached relays preserve measurement time, database rejects older GPS overwrites, active routes switch after collection/purchase, fresh unique driver counts are derived, and moving routes refresh at most every 20 seconds with stale response protection.
- Stripe top-up webhook rejects unpaid, wrong-currency and amount-mismatch events.

Validation: 12 automated regression groups, TypeScript and production build; SQL migration smoke-tested against the actual project inside a rolled-back transaction. Tests include proportional fare examples, configuration validation, address failures, GPS age/stage rules, unauthorized tracking, existing booking/receipt rollback/idempotency, new SQL approval immutability and GPS timestamp ordering. No signed-in device acceptance or real Stripe charge/refund has been performed.

Still open:
- Batch 5: signed-in address/map acceptance on target devices, full draft retention/relogin recovery and separate entrance details.
- Batch 6: audited settings history, full surcharge line-item display, chosen service radius, configurable product/quantity/weight limits, commission/minimum earnings policy and snapshot. Existing 75/25 earnings remain; no minimum was invented.
- Batch 7: direct order-specific Stripe checkout, original-payment refunds and cancellation reconciliation, interrupted-payment recovery. Current wallet booking remains. Existing refund actions still write wallet refunds and must be redesigned together with checkout; enabling only a card button would leave an inconsistent payment lifecycle.
- Batch 8: actual platform-funded purchase method, higher-price item approval flow, busy-shop reporting, shopping duration reporting and original-source unused-fund refund. No Issuing/card/bank funding mechanism was configured or simulated. Drivers must not be told that customer funds are available to them without verified funding.
- Batch 9: atomic OTP/earnings settlement, complete offer distance/time/snapshot, full document storage existence checks and acceptance races against concurrent verification changes. Existing availability/earnings rates are not represented as the final business model.
- Batch 10: authenticated multi-device tracking, permission denial/reconnect/background limitations and route concurrency UI tests. Browser background GPS is best effort, not guaranteed native tracking.

Production dependency: apply `20261030205108_configurable_booking_prices.sql` before the matching application release. Adds one JSON column to existing settings, a service-only approval RPC, and a GPS timestamp trigger. No existing orders are repriced and no customer payments are initiated. Verify remote migration versions before any future CLI db push; prior tool-applied migration versions differ from filenames.
