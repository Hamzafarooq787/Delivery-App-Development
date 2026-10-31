# Buy for Me checkout and product-list fixes

## Behavior
- Customer Stripe checkout no longer depends on the company Issuing balance. No customer wallet is required. Only confirmed paid orders are dispatched.
- Company purchase funds remain mandatory before shopping. Admin card verification reserves capacity atomically, including other active card allocations. Drivers must not use personal funds. Paid shopping orders notify admins that funding is needed.
- Default and live product limit increases to 15. Admin can configure 15–50; quantity, size, weight and purchase-value limits remain enforced.
- All products appear in one scrollable list in item entry, summaries and review. Product pagination is removed. Individual replacement preferences use a product selector.
- Step 2 requests a server-calculated total after shop and delivery selection, including purchase funds, shopping fee and route-based delivery. Missing item estimates do not imply free shopping. Before addresses are selected, the configured shopping budget is shown.
- Existing branding, cards and step flow are preserved.

## Verification
- 45 repair/payment/database tests pass, including 15-product Stripe checkout without Issuing balance or wallet access, idempotent retries, consent checks, paid finalization, unpaid-dispatch protection and card-capacity isolation.
- TypeScript, icon validation and clean production build pass.
- Browser checks use the real form components with mocked maps, quotes and payment services: desktop and 360×640 mobile confirm all 15 items are scrollable, item 15 remains editable, Step 2 shows the estimated total, and the footer stays accessible without horizontal overflow.
- No real payment, bank transfer, purchase-card funding or physical-device GPS permission was exercised.

## Deployment order
Deploy compatible application code first, then apply `supabase/pending-shopping-checkout-products.sql` to the existing database. The migration preserves existing pricing except raising product limits below 15, removes the checkout liquidity gate and adds the service-role-only company-card reservation RPC. It does not create new tables or move money.
