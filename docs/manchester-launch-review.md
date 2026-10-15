# Manchester launch implementation review

Status: draft implementation, not approved for production payments. The connected Supabase account does not expose the GoDrop project. The SQL preparation scripts have not been executed or checked against the deployed shopping schema. No real customer payment, purchase card charge or driver transfer was made.

## Pricing decisions

- Collect & Deliver: £4.49 includes two driving miles; additional mileage is proportional at £1.20 per mile, rounded to pennies only at the final fare.
- Buy for Me: £3.99 fixed shopping fee, the delivery fare above, and separate estimated purchase funds. The client's example using £4.99 conflicts with the explicit fee; this implementation uses £3.99. £25 of goods at three miles therefore totals £34.68.
- Five distinct products and £100 purchase-fund ceiling; quantities do not count as additional product types. Duplicate normalized product names are rejected.
- Driver standard: 80% of service fees, excluding purchase funds. Minimum earnings and platform subsidy are recorded separately on the accepted quote.
- Provisional settings requiring business confirmation: £4 delivery / £7 shopping minimum driver earnings; six units per product; 10 kg combined shopping weight; 60 cm maximum dimension; 15-mile Manchester service radius; 15-minute shopping estimate. These are proposed defaults, not client-approved rules.
- Van/heavy fees default to zero, busy/weather multipliers to one, waiting rate to zero, and first five collection minutes free. Shopping time does not generate automatic fees.

## Implemented in this draft

- Persistent admin pricing settings in the existing private brand-settings bucket, with role checks and validation.
- Authoritative driving-distance quotes and itemized extras; saved per-order fee/earnings snapshots.
- Direct Stripe booking checkout and paid-only dispatch; confirmation page with tracking number.
- Customer shopping-change approvals, additional purchase-fund checkout, receipt submission and unused-fund refund requests.
- Assigned-driver shelf-price checks, shopping problem reports, funded-card assignment and an Issuing authorization endpoint.
- Driver fee acknowledgement, Connect onboarding, exact offer earnings, weekly transfer batches and earnings reconciliation.
- Transfer attempts are claimed before contacting Stripe. An uncertain response is blocked for manual Stripe reconciliation rather than automatically retried after the idempotency retention period. Inspect `payouts.transfer_attempted_at`, `stripe_transfer_id`, failure text and Stripe transfer metadata before resolving a blocked batch. Never clear an attempt marker without checking Stripe first.
- Separate admin views of purchase funds, service fees, processing costs, refunds, earnings, subsidies, receipts and shopping durations.
- Direct booking cancellation is routed away from wallet credit. Accepted direct bookings require support review; unassigned requested bookings can cancel and request an original-card refund.

## Required before enabling live checkout

1. Connect the actual GoDrop Supabase project. Confirm existing shopping tables, columns, statuses, constraints, receipt storage access, user roles and RLS policies. Do not apply these scripts to another connected project.
2. Review scripts 034–038 against a staging copy of the deployed schema; execute and verify transaction, ownership and concurrency behavior. These are preparation scripts, not a generated or verified migration history. Run database security advisors and check role privileges before production use. No new application tables are proposed.
3. Configure test Stripe checkout credentials and the signed `/api/stripe/webhook` endpoint. Verify booking and additional-budget payments, delayed events, duplicate events and expired sessions.
4. Complete Stripe Connect platform setup and driver onboarding. Fund platform liabilities including minimum-payment subsidies and processing costs. A Connect transfer is not proof that the driver's bank payout has arrived; verify account payout schedules and payout events.
5. Provision GoDrop-owned Issuing cards, separately fund the Issuing balance and verify driver-card metadata. Customer Checkout funds do not automatically make a card spendable. Configure the signed `/api/stripe/issuing` authorization endpoint and timeout behavior to decline. Keep `GODROP_SHOPPING_FUNDING_READY` disabled until full purchase tests pass.
6. Keep `GODROP_WEEKLY_PAYOUTS_ENABLED` disabled until payout reconciliation tests pass. Set `CRON_SECRET`; the proposed weekly cron runs Monday at 09:00 UTC. Reconcile existing manual payout history before batching historical pending earnings.
7. Validate receipt amounts against actual Issuing transactions, including reversals, partial captures, voided authorizations and failed refunds. The current draft reserves authorizations conservatively but does not yet reconcile the complete Issuing settlement lifecycle. Do not activate shopping purchases until this is completed.
8. Complete customer-approved collection waiting-charge billing. Settings and quote rules exist, but timed collection events, a customer-approved cap and the additional-payment flow are still outstanding. Keep the waiting rate zero until that flow is tested. Never charge shopping duration automatically.
9. Complete refund-event reconciliation, cancellation after driver acceptance, abandoned-checkout cleanup and durable booking request deduplication. Review legacy wallet booking RPC access so it cannot bypass the new launch requirements.
10. Verify every completion route uses the saved driver earnings snapshot exactly once, with no legacy manual payout path able to mark Stripe batches paid. Verify rejected substitutions, replacement quantities, and card purchase totals under simultaneous driver/customer requests.
11. Review admin totals and add pagination/aggregate reporting before relying on them for accounting. Current views are bounded operational lists; recorded commission and earnings can include legacy orders and are not audited all-time financial statements.
12. Test Android and iPhone form heights, keyboard behavior, three-to-five saved products, approval prompts, desktop layout and accessibility. New shopping-limit content has not yet had a fresh device-layout pass.

## Verification completed locally

- `node scripts/test-launch-pricing.cjs`: client examples, fractional miles, fixed shopping fee, product/quantity/value limits, service area, minimum earnings and subsidy calculations.
- `node scripts/test-launch-checkout.cjs`: mocked authoritative totals, service/purchase split, role and launch gates, payment/currency/owner checks, repeated fulfillment and one driver notification.
- `node scripts/test-weekly-payout-safety.cjs`: mocked transfer amounts and key, concurrent batch claiming, and no automatic second transfer after uncertain database persistence.
- TypeScript and a production webpack build are checked separately. A build alone does not verify database SQL, Stripe, driver funding, payouts or mobile usability.

## End-to-end acceptance cases still required

Booking → exact driving quote → card payment → paid-only offer → driver acceptance → live location → pickup proof → delivery PIN/photo → one earnings row → one weekly transfer → bank payout confirmation.

Shopping additionally: estimated funds → funded card → shelf prices → rejected/approved replacement → higher-budget payment → correct authorization → actual purchase → receipt → unused-fund refund → settlement reconciliation. Include unavailable products, busy shop, insufficient platform funding, interrupted network, two simultaneous approvals, duplicate webhooks, failed refunds and duplicate cron invocations.

Keep both admin checkout enable switches false and `GODROP_LAUNCH_VERIFIED` unset until these release checks pass. The server rejects direct checkout until that explicit verification flag is true. A demonstration can show the reviewed UI without enabling real-money transactions.
