# Customer follow-up — one repair batch

## Scope and result
1. Pre-booking GPS updates the local destination without trying to publish an active delivery location. The actual form function and browser flow both accept simulated GPS successfully.
2. Stopping a draft GPS watch or selecting a saved destination never clears active-order sharing. The server rejects a sharing-clear request without a specific delivery ID.
3. Sharing is available on the explicitly selected order tracking page, labelled with that order's tracking code; the first visible shipment no longer chooses the recipient. Sharing stops when leaving that tracking screen. Exact-job read policies and the 45-second stale-signal expiry remain active.
4. Shopping tracking obtains completed wallet refunds from the authenticated customer's order ledger. Actual recorded credits drive totals; settlement alone does not invent a refund, and extra refund credits are not ignored. Payments and Tracking agree on full cancellation returns.
5. Customer-facing payment states now show refund pending, partially refunded or refunded. Original accounting/dispatch payment state remains unchanged; gross monthly charges remain gross.
6. Centre Map refits the existing map; Satellite toggles Google map type without changing branding or destinations.
7. Shipments refresh through realtime plus visible polling/focus recovery. An open order-details dialog independently reloads its exact order, even after the order leaves the active list; stale cancellation controls are hidden during refresh/failure.
8. Wallet transactions use authenticated server-side pagination and stable creation-time/ID ordering. Older records beyond the first fifty remain accessible.
9. Address deletion handles network errors, releases its busy state and supports retry. An unconfirmed deletion does not remove the address locally. Preference-load failures also have an inline retry.
10. An order message and its recipient inbox notification commit atomically using existing tables. A repeated request key does not duplicate the message or notification. A newly committed notification schedules push after the response through the existing notification service. Inbox entries and toast actions use validated recipient-role order links. Realtime inbox updates are enabled, with a visible fallback refresh; inbox entries support keyboard activation.

## Verification
- 88 automated tests pass (previous 76 plus 12 follow-up checks), including PostgreSQL notification/message atomicity and rollback, retry idempotency, recipient authorization, payment-state projection without accounting mutation, full and extra wallet refunds, older wallet paging, scoped location clearing and execution of the real pre-booking GPS function and map adapter.
- TypeScript, icon validation and a clean production build pass.
- Browser QA uses actual components with test services and a simulated Maps adapter/GPS. Map recenter increases fit requests and Satellite changes map type. Tracking sends and clears the exact selected order ID. Draft GPS succeeds and Stop sends no server sharing/clear request.
- Wallet UI displays transactions 57–64 of 75. An open shipment dialog changes from Driver assigned to Delivered after completion removes the order from the active list.
- A simulated address-delete network failure retains the address and shows a retry; the second confirmed attempt removes it. Preference retry re-enables controls after a simulated initial failure.
- A simulated realtime message creates an inbox entry whose click opens the exact customer order. Background push scheduling and duplicate suppression use test services; no real message or push was sent in verification.
- Mobile wallet and tracking document client/scroll widths are 320/320 and 430/430.

## Rollout and limits
`supabase/pending-customer-followup-batch.sql` updates one payment-read RPC, adds an action URL column to the existing notifications table, and adds a server-only security-invoker message/notification RPC. No new tables or monetary transfers are created by this migration. Deploy the additive migration before the application.

Supabase leaked-password protection remains an external Pro-plan requirement; the existing organization is Free. No paid upgrade was performed. Real Stripe purchases/refunds, push delivery to physical devices and physical iPhone/Android GPS remain unverified. Automated and fixture-based checks do not certify these real-world flows.
