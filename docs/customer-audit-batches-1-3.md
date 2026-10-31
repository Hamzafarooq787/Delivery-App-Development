# Customer audit — Batches 1–3

## Batch 1: privacy and access
- Driver-name lookups authenticate callers, bound input IDs and return only drivers assigned to that customer's orders (admins keep their management access).
- Customer driver-location policy matches both the driver and the exact active delivery. Tracking requests order matching and passes the shopping stage so the target remains the shop until purchase completion.
- Item photos and shopping receipts use authenticated same-origin readers with 60-second signed URLs. Owners can preview their uploads; other users require an exact authorized order reference. Another customer's image cannot be made accessible simply by attaching its URL to an order. New card and legacy wallet bookings reject foreign-owned photos.
- Existing customer, driver and admin photo readers use the protected route. Stored object references remain unchanged. No files are deleted.
- The storage bucket becomes private and its public read policy is removed only after compatible application code is live.

## Batch 2: shopping approvals
- Tracking contains the customer's requested products, quantities, proposed replacements/prices, price changes, notes and approval/rejection buttons.
- Buttons lock while saving. Existing atomic database ownership, active-stage and immutable-decision protections remain authoritative.
- Customer and driver views refresh decisions in the background while visible. Approval and receipt notifications link to the exact order.
- Approval does not increase prepaid funds; existing funded-card, basket-budget and receipt-reconciliation checks remain intact.

## Batch 3: shopping order details and totals
- Customer tracking shows prepaid funds, service fees, original charge, actual receipt total, unused funds, individual refund states and charge less completed refunds. Pending refunds are never described as completed.
- Receipts and requested item photos are accessible through authenticated links. Unsettled purchases are labelled unknown, not £0.
- Shipment/history details use the full shopping booking charge and link to the full shopping breakdown. Payment details also show actual shopping and unused funds.
- Long tracking details scroll within the existing fixed frame on desktop and mobile.

## Verification
- 63 tests pass, including database tests for exact-order location isolation, anonymous storage denial, private bucket configuration, forged photo-reference denial and service-only RPC privileges; server tests for authenticated name lookups, protected image redirects, customer-scoped shopping reads, foreign-photo checkout rejection and pending/completed financial calculations.
- Existing atomic substitution-decision and approved-basket purchase tests pass.
- TypeScript, icon checks and production build pass.
- Browser QA uses real customer components with test services: approve/reject, double-click lock (one request), pending-to-completed refund refresh, 15-product scrolling and a 320px sidebar without horizontal overflow.
- Real Stripe purchases/refunds, push delivery to physical devices and physical iPhone/Android GPS were not exercised. No real payment or customer shopping decision was submitted during verification.

## Rollout
Prepare the service-role photo-authorization helper; deploy compatible application code; apply `supabase/pending-customer-batches-1-3.sql`; then verify live policy/bucket/function privileges and deployment error logs. No new tables or financial transfers are required.
