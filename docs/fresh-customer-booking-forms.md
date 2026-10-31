# Fresh customer booking forms

The customer home no longer mounts the unfinished-payment banner or requests its list. No saved-checkout links cover the page.

Collect & Deliver and Buy for Me keep unfinished entries only in the open form's React state. Automatic session draft saving and restoration are removed. Closing, reloading or opening a new form starts fresh. The new form hook discards old booking-draft keys from previous app versions without reading or restoring their contents; it does not clear unrelated storage or require another authentication call.

Intentional Stripe payment callbacks, paid orders, payment records, idempotency and tracking remain intact. The separate wallet top-up return still supports the customer-initiated payment journey; it is not an automatic home-page reminder. The checkout cancellation page keeps its explicit Continue payment choice and no longer promises a saved form.

Verification: 54 repair/payment/database tests pass. New tests cover old-draft cleanup, storage isolation, lack of automatic persistence/auth requests, repeated cleanup and restricted browser storage. TypeScript and icon checks pass. Browser QA uses real shopping components with test services and a seeded old draft, and checks a fresh empty form and close/reopen behaviour. No live payment or customer order was changed.
