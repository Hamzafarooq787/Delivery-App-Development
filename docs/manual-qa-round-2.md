# GoDrop live QA, round 2

## File-by-file changes

| File | Change |
|---|---|
| `app/(public)/pricing/page.tsx` | Removed invented plans, dollar prices and add-ons. Uses the booking pricing and shopping settings on every request, reads the current busy-pricing switches, and calculates the example with the booking fare function. Explains size, waiting, traffic, shopping funds and refunds. |
| `app/(public)/our-fleet/page.tsx` | Replaced unsupported fleet claims with the same bicycle, motorcycle, car and van options and parcel limits used by driver onboarding and booking. |
| `app/(public)/contact/contact-form.tsx` | Plain heading and example email; asks for a short message and the tracking number if available. |
| `app/(public)/about/page.tsx` | Replaced the old description, invented statistics and team profiles with the services GoDrop actually offers. |
| `app/(public)/safety/page.tsx` | Removed unsupported scanning and enforcement claims; links to the existing restricted items list and vehicle guide. |
| `app/(public)/how-it-works/page.tsx` | Replaced decorative emoji with Lucide SVG icons and removed the obsolete style class. |
| `components/home/BookingCard.tsx`, `FleetSection.tsx`, `Hero.tsx`, `HowItWorks.tsx` | Removed unused old landing-page components that contained obsolete booking options and fleet claims. |
| `components/layout/Footer.tsx`, `StandaloneFooter.tsx`, `components/public/public-footer.tsx` | One footer with a plain tagline, common links and normal-case copyright. The old footer export points to it. |
| `components/home/HomeSlides.tsx`, `app/layout.tsx` | Add the shared footer to home and standalone public pages. The existing public shell uses the same footer. |
| `app/login/page.tsx`, `app/signup/page.tsx`, `app/driver/login/page.tsx`, `app/download/page.tsx`, `app/auth/account-linked/page.tsx` | Remove duplicate copyright lines; clean up old brand text on sign-in and account pages. |
| `app/dashboard/admin/layout.tsx` | Explicit browser title: GoDrop Admin. Root metadata already used the correct brand. |
| `app/firebase-messaging-sw.js/route.ts` | Retire the old cache and stop storing or reusing Admin HTML on navigation. The stale title was reported in the browser but its original source was not reproduced. |
| `app/signup/page.tsx`, `app/actions/auth.ts`, `lib/uk-phone.ts` | Show the same UK mobile validation message on blur and on the server. Display the required mobile field for driver email signup as well as customer signup. |
| `app/globals.css`, `hooks/use-push-notifications.ts`, `lib/email/send.ts` | Clean up the brand name in the theme comment, notification fallback and email text. |
| `lib/browser-location.ts`, `components/tracking/driver-location-broadcaster.tsx`, `components/tracking/live-tracking-panel.tsx`, `components/driver/earnings-panel.tsx` | Plain text for location errors and the earnings chart. Technical JavaScript terms such as `void`, cancellation signals, DOM references and runtime names are unchanged. |
| `tests/manual-qa.test.mjs`, `tests/full-app-audit.test.mjs` | Cover live price-setting changes, fleet parity, wording and icons, shared footer, phone validation and Admin cache handling. Update the signup regression fixture to use the new validator. |

## Supabase Auth incident

The Supabase connector returned an edge **522** on the project’s `/auth/v1/authorize` at **2026-11-04 14:59:02 UTC** (19:59:02 Pakistan time), Ray ID `a5547af17efff462`. The edge and Auth logs show a successful **302** at 14:59:44 UTC. The failed request did not show a matching application callback. A 522 means the Cloudflare edge timed out reaching the origin; it does not explain why the origin failed to respond.

The project was `ACTIVE_HEALTHY`, region `us-east-1`, and its organisation is on the Free plan. PostgreSQL reported that it started on 15 July 2026, 27 connections against a 60-connection setting, and an 18.6 MB database. This is a current snapshot, not historical CPU or memory use. The observed incident does not look like a database wake-up. The connector did not expose the actual compute SKU or historical CPU/RAM/disk charts; Nano is the documented Free-plan baseline, not a measured SKU. PostgREST also reported timeout messages in the surrounding window, but the available logs do not link those to the Auth failure.

No project, plan, compute, Google OAuth or billing settings were changed. If the issue returns, send Supabase the project reference, UTC time and Cloudflare Ray ID. Check the project's infrastructure charts at that timestamp before deciding whether more compute is needed.

References: [Cloudflare 522 documentation](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-522/), [Supabase compute and disk documentation](https://supabase.com/docs/guides/platform/compute-and-disk).
