# Admin repairs: batches 1–3

Scope: settings access and validation; dispute handling and review failures; stable customer/driver identity and verification queues.

## Changes

- Browser roles can select only explicit public pricing columns. Operational settings, histories and worker fields remain server-only. Admin forms load only the surge fields they need.
- Surge settings and busy-period rules use runtime validation. Database constraints enforce multiplier bounds. Invalid surge caps cannot reduce a fare. Failed pricing reads do not silently omit surge.
- Busy-period edits submit explicit editable fields. Creation returns the real saved ID, so later edits/deletes use the database record rather than a temporary client ID.
- Disputes use `issue`, `raised_by` and `delivery_id`. Supported outcomes are open, resolved and rejected. Resolution uses an atomic open-status condition; missing or already changed cases return an error. The page supports searching loaded cases and linking the order.
- Customer dispute counts use `raised_by`; failed reads do not appear as zero. Failed driver approval/rejection is visible on the detail page.
- Service-only, security-invoker identity views include customer profiles/order history and driver profiles regardless of the active dashboard mode. Customer lists, driver names, marketing audience and new-customer report counts use these identities. Marketing consent flags remain unchanged.
- A service-only atomic mode-switch function shares the driver-profile lock used by assignment. Active driver deliveries block switching to customer mode. Missing profiles and admin role changes are rejected. Idle customer-mode switches clear online availability and stale GPS; returning to driver mode preserves compliance and existing jobs.
- A database guard prevents a customer-mode profile from going online. Existing inconsistent online flags are cleared without changing order assignments or deleting profiles. Existing active-job GPS is preserved during this cleanup.
- The overview approval queue excludes unsubmitted drafts, matching the verification page.

## Validation

- Regression suite: 127 tests, including 16 new admin tests.
- PostgreSQL-compatible tests exercise grants, database constraints, role switching, identity/report counts and dispute compare-and-set updates.
- Action tests cover authorisation, rejected inputs, missing records and useful failure messages. Marketing tests preserve individual consent and activity filtering.
- TypeScript, icon checks and production build are required before release.
- Apply `20261031191449_admin_batches_1_3.sql` before deploying the application changes. Verify live grants, views, constraints, function permissions, corrected dispute queries and stale online counts after migration.

## Boundaries

This completes only batches 1–3. Financial reconciliation/reporting, full customer history, expanded operational settings, live-map resilience, waiting-fee settlement and bank payout acceptance remain in their later roadmap batches. Existing list size caps remain for the pagination batch. No customer charge, refund, message, document approval or bank payout is used as a live test.

## Live database verification

The migration applied successfully. Live privilege checks confirm that public pricing remains readable, internal operational/worker columns and browser writes are denied, and the mode-switch function and identity views are service-only. Corrected dispute reads compile against the actual database. Stale customer-mode online flags are now zero. The read-only checks did not change any delivery assignment or financial record.
