# Driver batches 1 and 2

Scope: driver order access, immutable evidence, compliance re-review, one-active-job acceptance, Buy for Me completion, GPS and concurrent shopping-stage updates. Existing tables only. Pricing, payouts and the visual design are outside this batch.

## Changes

- Remove the direct open-order SELECT policy. Offers still come from the authenticated server action, which checks the driver role, approval, registered vehicle, paid orders and active-job capacity, and selects offer fields explicitly. Assigned drivers and owning customers retain their own order access.
- Remove driver-document bucket UPDATE and DELETE policies. New uploads still work. Proof and compliance files are append-only; replacing a document uploads a new object. Existing objects are not deleted.
- Require vehicle and document mutations through server actions. Database triggers reset an approved driver to pending/offline after meaningful changes. Changes are rejected during an active job so the driver can finish that job without losing panel access. A no-op vehicle save does not reset approval.
- Replace documents within one database transaction and under a driver-profile lock. A failed replacement preserves both the old document record and the previous approval state.
- Serialize assignment under the driver-profile row lock. A driver cannot claim or be assigned another active job, even through simultaneous requests. Existing multiple assignments are retained, not cancelled or reassigned. The driver can continue them; the selected dashboard job or open job-detail route controls GPS selection, validated against owned active rows.
- Open the OTP modal before resolving the next shopping stage. Closed orders have no advance action. Completion requires the assigned driver, final delivery stage, receipt settlement and correct OTP. It updates the shopping stage to delivered, supports a safe completion retry, and clears that job's GPS record.
- Shopping-stage writes compare order ID, assigned driver, main status and the previous shopping stage. Stale requests cannot overwrite a newer stage.
- Publish GPS through a service-only transaction that checks the active assignment, approval, coordinates and measurement freshness. Older pings cannot overwrite newer ones. Browser clients cannot write locations directly. Location clearing requires a specific delivery ID.

## Verification

- Regression suite plus driver tests: 100 tests, covering access isolation, evidence permissions, compliance edits, replacement rollback, job claims, vehicle/payment gates, GPS freshness, completion/retries, the actual final-button component handler, stale shopping stages and existing multi-job GPS selection.
- TypeScript and icon checks passed. Clean production build passed. The first build failed on an existing Turbopack persistence cache; moving the cache out and rebuilding succeeded.
- Live database migration applied and read-only verification passed: a signed-in driver cannot read unassigned order rows; evidence UPDATE/DELETE policies are absent; direct vehicle/document/GPS writes are denied; the GPS RPC is service-only; both review triggers exist.
- Security advisors unchanged from baseline: three server-only tables without client RLS policies, existing is_admin/cancel RPC notices, and leaked-password protection unavailable on the current Free plan. No new warnings.

No real customer orders, driver documents, purchases, notifications, OTP codes or bank transfers were created or changed during testing. Physical iPhone/Android GPS, real purchase-card use and real bank payout tests are not claimed here.

## Operational notes

Deploy the application and this migration together. The migration is already applied to the linked GoDrop database. Do not restore the broad open-order or mutable-evidence policies when rolling back application code. Continue existing active jobs before changing compliance details. Once a document/vehicle changes, admin approval is needed before new jobs can be accepted.

The remaining audit batches (verification UX, shopping navigation/contact, earnings/payouts, support and performance) are separate work.
