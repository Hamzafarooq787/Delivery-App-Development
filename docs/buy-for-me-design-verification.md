# Buy for Me approved design

Replaced the old form with the approved four-step dark/orange layout, using existing theme variables so the admin's purple theme also applies. Desktop uses a form/map split. Mobile uses a compact expandable map, fixed actions, paged saved products and an expandable review summary to keep prices visible on short screens. Internal overflow remains available for expanded details, the keyboard, larger text or unusually long content.

## Existing integrations

- Server-configured product, quantity, weight, size and spending limits.
- Existing Google address suggestions, place coordinates, reverse geocoding, exact map pin picker and shared driving-route map. Expanded route maps are preserved.
- Existing native/fallback browser location controls and shared permission recovery dialog.
- Existing compressed item photos, private customer upload folder and photo metadata fields. No new bucket or table.
- Existing account-scoped booking drafts; unfinished legacy rows are excluded on restore.
- Existing server quotes, signed consent, idempotent Stripe Checkout and checkout return/tracking flow. No payment or payout logic changed. The shopping allowance charged upfront is shown separately from the product estimate, delivery and shopping service, with the existing refund explanation.

Item editing is isolated until Save. Cancel keeps the saved product. New items cannot erase earlier products. Duplicate names/sizes direct the customer to edit quantity. Quotes are invalidated after changes; stale location/quote responses are ignored. Browsers without `crypto.randomUUID` use cryptographic UUID generation through `getRandomValues`.

## Verification

- Repair suite: 41 tests, including duplicate product/variant handling, signed-estimate compatibility and older-browser request IDs.
- TypeScript, production build and icon validation.
- Browser QA uses the current React components compiled into an isolated harness. Backend settings, address responses, route responses, pin selection, storage and checkout are test doubles. Google Maps loading is intentionally unavailable in the harness, so its fallback and expanded dialog are tested, not Google's live map service.
- Browser checks: add three products; keep all products after adding another; discard an edited name on Cancel; restore the saved draft; enforce the five-product maximum; page all five products; select both address suggestions; confirm a selected shop pin; expand/close route map; require size/weight acknowledgement; show £100 prepaid shopping funds + £3.99 service + £5.69 delivery = £109.68; require review acknowledgement; pass a complete order to the mocked checkout.
- Real iframe viewports 360×640 and 430×844: all four steps keep footer actions inside the viewport, no horizontal page overflow. Short-screen default sections fit without body scrolling; expanded details remain accessible. Desktop QA at 1363×936 confirms split layout and fixed actions. A 393×700 viewport was also inspected.
- Live Google route accuracy, real storage writes, physical device GPS and real Stripe transactions were not exercised by the isolated harness. No live test order or payment was created.
