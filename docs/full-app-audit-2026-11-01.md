# GoDrop: follow-up application audit — 1 November 2026

This audit builds on the customer, driver, admin and cross-panel wiring repairs already merged in PRs 190–193. It covers source-level navigation and API review, existing cross-panel regression tests, additional identity/notification tests, production build checks, database permissions and live record reconciliation. It is not a claim that every real device or external payment-provider scenario has been exercised.

## Confirmed defects repaired

| Area | Defect | Result |
|---|---|---|
| Signup | A returned signup user, including an obfuscated duplicate-signup response, could trigger service-role overwrites of existing role, name, phone, address or driver approval. | Public signup no longer performs these writes. The Auth INSERT trigger initializes the new identity and its selected, allowlisted customer/driver profile in one transaction. Metadata cannot create an admin. |
| Login / OAuth | Ignored database read errors and check-then-upsert races could overwrite an existing role; callback profile writes could reset an approved driver to pending. | Verified profile initialization uses insert-on-conflict-do-nothing and reads the stored role. Database failures and inactive accounts fail closed; existing approval and profile data are preserved. Callback role arguments are allowlisted. |
| Password recovery | Client and server recovery requests took a separate direct-page route while other auth flows used the PKCE callback; the server reset action left the recovery session signed in. | Both request paths use the recovery callback, and the server reset action signs out after updating the password, matching the existing client reset page. |
| Secondary roles | The add-profile action could create secondary access for an unavailable account or an administrator. | Active-account and role checks precede the insert-only write. |
| Device registration | REST and server actions used different ownership rules; non-atomic delete/upsert could associate one browser token with multiple accounts. | Both use a service-only atomic claim RPC with global token uniqueness, input limits and an active-account check. Browser INSERT/UPDATE privileges are revoked. |
| Logout | The browser session was cleared without attempting to unregister that browser's notification token. | A successfully registered token is remembered locally and detached before browser sign-out. Other token records are not deleted by this operation. If the device is offline, session sign-out still proceeds; provider/device delivery in that condition requires real-device testing. |
| Notification APIs | Any admin could use a generic cross-account send endpoint without scoped admin/MFA checks; arbitrary payloads were accepted; diagnostics performed send/purge operations on GET and exposed token prefixes and internal diagnostics. | Public POST only permits a fixed self-test, with a database-backed 60-second cooldown. Operational sends remain in verified workflows; campaigns remain in scoped consent-aware admin actions. Diagnostics require settings access through the existing MFA-aware guard, return safe counts/configuration booleans, and never mutate on GET. |
| Notification preferences | Inactive accounts could still be targeted; an old driver profile's disabled preferences could suppress a user's customer notifications. | Inactive-account sends are skipped. Driver-specific settings apply in driver mode; service and marketing consent checks remain enforced. |
| Customer / driver messaging | Legacy `picked_up` orders were active for tracking but excluded from customer contact and database message permissions. | Both the contact action and thread RPC accept this active status. Participant/assignment checks remain intact. |
| Public home | Buy for Me was still described as Coming soon despite its booking flow being implemented. | Obsolete copy and register-interest CTA are replaced with shopping copy; booking continues to enforce live operational settings and service-area checks. |

No form redesign, price changes, new customer tables, artificial orders or financial transactions were introduced.

## Verification

- Existing regression coverage plus 14 new executable tests: 213 distinct tests.
- New tests execute the migration against isolated PGlite schemas and exercise Auth trigger initialization, admin-role rejection, device ownership transfer and uniqueness, inactive accounts, malformed tokens, grants, rate limiting, legacy-status chat permissions, profile read failures, driver approval preservation, administrator preservation, API recipient restrictions, read-only diagnostics and duplicate signup responses.
- Full optimized Next.js build and TypeScript checks pass.
- Icon validation passes for all 172 referenced icon names.
- Literal internal navigation scan across app/component TSX files found no missing page targets.
- Migration applied successfully to production. Read-only production checks confirm that the device-claim RPC is service-only, browser token INSERT is disallowed and duplicate token ownership is zero.
- Production reconciliation before and after migration: 20 orders, 25 payments (20 paid), 3 earnings totalling £59.10, 36 wallet entries, wallet total £918.25, 15 registered devices. No counts or financial totals changed.
- Existing deployment error/fatal log query for the preceding 30 minutes returned no entries; this is bounded log evidence, not proof of device behavior.

## Operational items retained explicitly

- Three historical active assignments for one driver require an operator to confirm physical delivery status. No customer jobs were arbitrarily cancelled or reassigned.
- The historical £26.25 payout remains pending, with its reconciliation note. No payout was marked bank-paid.
- Stripe Connect onboarding/KYC, connected bank-account readiness and authorized provider end-to-end payout/refund/card-purchase testing remain required before automatic bank payouts are enabled.
- Real iPhone/Android location-permission dialogs, offline behavior, camera uploads, push receipt and physical delivery confirmation require tests on those devices. Browser code cannot override a device/browser permission denial.
- Supabase security advisories retain the previously reviewed items: five intentionally server-managed RLS tables with no browser policies; session-scoped is_admin/cancel_delivery_order RPC execution warnings; leaked-password protection requires the paid-plan capability. No automatic plan upgrade was made.

Release source and deployment checks are attached to the accompanying pull request. Verify the final main commit and godrop.uk alias after merge; do not equate a passing preview build with a production release.
