# Automatic bank payouts

Implementation: a verified approved driver completes Stripe-hosted Connect recipient onboarding from Driver → Payouts. Bank and identity documents stay at Stripe. Account creation is idempotent; an unresolved creation older than 20 hours fails closed for reconciliation. Existing manual payout history must be reconciled before automatic payments for that driver.

Admin → Payouts contains an enable/pause control. It defaults to paused. This is an activation setting, not a claim that GoDrop's Stripe business account is enabled or tested. No real transfer was made during implementation.

Monday 08:00 UTC reserves exact unpaid earnings; daily 08:30 UTC processing sends eligible service-fee earnings to verified connected accounts, then requests standard GBP bank payouts. Provider IDs, creation intents and a global worker lease prevent blind duplicates. API success followed by a failed database save is recovered by provider metadata; after 20 hours an uncertain creation is never repeated automatically. Paid is set only from a retrieved Stripe bank-payout object. Later bank returns restore the reserved liability. Manual rejection/mark-paid is blocked after provider ownership begins.

The worker checks up to 50 oldest-unchecked requests per invocation within a 40-second processing budget; connected webhooks prioritize the affected payout. Monitor queue growth and increase reconciliation frequency/capacity on a suitable hosting plan before exceeding that throughput. Pausing stops new movements on subsequent worker runs; in-flight requests can complete. Reconciliation of existing bank payouts continues when paused.

## Provider activation and acceptance still required

- Stripe Connect must be enabled for the GoDrop business account. Account-owner verification and each driver's bank/KYC checks must be completed by the respective person. Do not impersonate them.
- Existing STRIPE_SECRET_KEY must have the required Connect API permissions. NEXT_PUBLIC_APP_URL must be the trusted HTTPS production origin.
- Register https://godrop.uk/api/stripe/connect-webhook for connected-account snapshot events payout.created, payout.updated, payout.paid, payout.failed and payout.canceled. Store its signing secret as STRIPE_CONNECT_WEBHOOK_SECRET in production. Do not paste secrets in chat. Daily reconciliation works without this secret, but instantaneous event delivery is not verified.
- Test onboarding, a standard bank payout, a failure/return and a database-save retry in Stripe test mode; then verify a business-authorized live payout. The code tests use a fake provider; they are not bank acceptance tests.
- Keep the admin control paused until these steps pass. No deployment should silently enable actual money movement.

## Goods funding and reconciliation limits

Purchased items are not driver earnings. A conservative reserve excludes all paid shopping budgets less confirmed unused-shopping/cancellation refunds, plus unresolved refund liabilities, before new transfers. Ordinary service-fee refunds never reduce the goods reserve. This intentionally continues to exclude spent goods money until a separate goods-funding reconciliation exists; it may delay driver payouts and require GoDrop capital. It is not bank segregation or Stripe escrow. Concurrent external balance movements and manual dashboard operations require operational reconciliation.

Failed/uncertain bank operations keep their earning claims and provider references. They are surfaced for reconciliation, never automatically released for a second transfer. Correct the bank account and reconcile returned funds in Stripe before any replacement payout workflow. Automated replacement of failed bank payouts and complete goods-funding/chargeback reconciliation remain open.

Other acceptance remains open: authenticated customer/driver/admin flows on the requested phones and desktop, real Checkout/refund/Issuing flows, approved waiting-charge consent, service area policy and launch-approved driver/legal terms. Do not describe this release as all bugs fixed or launch acceptance complete.


## Failed-bank-payout recovery update

Admin → Payouts now provides “Verify returned funds and retry bank payout” for failed/canceled operations. The server retrieves the prior bank payout under the stored connected account, verifies its amount/currency/order metadata and available return balance transaction, and checks that bank payouts are active. A locked service-only RPC records the prior payout, return transaction, admin and time; keeps the original transfer; and increments the bank attempt. Replays and concurrent worker updates are rejected. Each attempt has its own stable key and metadata. Three replacements are allowed before manual support is required. Reversed/partially reversed platform transfers block new bank attempts.

This supersedes the earlier statement that failed-bank replacement is not implemented. Actual Stripe acceptance, KYC, webhook connection, goods funding, chargeback reconciliation and signed-in device testing still need verification. Keep automatic payments paused until acceptance is complete.
