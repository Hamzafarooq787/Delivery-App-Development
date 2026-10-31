# Customer home loading and speed

- Customer home receives authenticated, customer-scoped data from the server. It no longer starts with shopping disabled and waits for a browser-side authentication/query/action chain.
- Independent profile, active-delivery, wallet and service-setting reads run concurrently. React request-scoped caching shares the authenticated-user lookup between the dashboard layout and page; no user data is cached across requests.
- Enabled shopping is available in the first server render. An actual disabled setting says temporarily unavailable. A settings-read failure is unknown, not false; the booking form retries and enforces live availability.
- The home component makes no hydration-time data fetches for profile, wallet, deliveries or service availability. Pending checkout recovery remains enabled on home, with requests removed from unrelated customer routes and rejected-request handling added.
- Shopping form settings load through one server action with parallel database reads, replacing two client server-action calls. Shopping code remains lazy, with pointer/focus preloading for quicker opening.
- Existing customer theme, layout, payment rules and live availability checks are retained.

Verification: 50 tests pass, including first-render enabled/disabled/unknown states, parallel customer-scoped reads, anonymous access prevention and isolated settings/wallet failures. TypeScript and icon checks pass. Browser checks use real home/form components with mocked external services. No real customer payment or device-location request was made. These changes remove known request delays; no whole-app speed percentage or real-device timing is claimed.
