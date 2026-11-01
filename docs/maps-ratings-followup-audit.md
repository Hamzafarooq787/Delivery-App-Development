# GoDrop follow-up audit: maps, pricing, ratings and support chat

Date: 1 November 2026. Builds on PR 194, without redesigning the booking forms or changing configured prices.

## Confirmed defects and repairs

| Area | Defect | Repair |
|---|---|---|
| Maps APIs | Authentication was present but active-account checks, paid request budgets, bounded inputs and consistent network timeout handling were missing across several proxies. Malformed requests could throw instead of returning a useful response. | Shared verified-account checks and service-only database budgets. Maps: 120 requests per account/minute and 1,200 total/minute. Invalid inputs are rejected before quota/provider use. All provider calls have bounded timeouts; failures return controlled errors. |
| Maps diagnostics | Provider error text could pass through the API; missing server configuration was exposed as an internal configuration string or a generic server crash. | Shared sanitized proxy responses; unavailable providers return a service error without keys or provider diagnostics. |
| Reverse geocoding | Invalid result filters consumed quota before validation; provider-level errors could return HTTP 200. | Validate filters first, then use the existing public quota and the shared provider error handler. Public location detection remains available. |
| Quote pricing | The authoritative directions helper rejected legitimate zero-distance legs; rounding both durations before calculating the traffic ratio could hide heavy traffic on short journeys. | Accept finite nonnegative distance/duration, preserve exact durations for traffic comparison, round only the displayed quote duration. Add quote-side maps budgeting before the authoritative request. Rates and surge thresholds remain unchanged. |
| Ratings | Pending-review counts used service access without checking admin support scope. | Apply the existing scope/MFA-aware admin guard before reading the count. |
| Rating submission | A historical participant with an inactive account could submit a review; comment type/size and participant checks were not enforced together at the write boundary. | Atomic service-only RPC checks active actor, completed order, exact participant/recipient, score and comment length. Existing unique order/rater constraint prevents duplicate reviews. |
| Rating summary | Reading every score through REST silently truncated results at the row cap, giving incorrect averages and counts above 1,000 reviews. | PostgreSQL aggregate over all approved ratings. Pending and rejected reviews remain excluded. |
| AI support | No request budget/history bounds, forged roles were not rejected, provider failures could be confused with user login failure, and initialization depended on provider configuration at import time. | Active-account guard, 6 requests per account/minute and 60 total/minute, validated user/assistant roles, bounded history and messages, lazy SDK initialization, bounded timeout/no automatic paid retries, sanitized service errors. The system instruction explicitly prohibits inventing account records or claiming to perform account operations. |
| Chat retry | A failed send cleared the typed message and retained the unanswered entry; sending entire ever-growing history could eventually fail. | Restore unsent text on failure, remove its failed timeline entry, and send a bounded recent conversation window. The visual design stays the same. |

## Validation

15 additional tests cover integration budgets, cross-service bucket preservation, inactive accounts, database grants, >1,000-row aggregation, review eligibility/duplicates, maps input and authentication failures, quota responses, sanitized provider errors, zero coordinates, zero-distance pricing, exact traffic ratio, provider timeouts, review-count permissions and bounded chat history/configuration handling.

The complete regression suite contains 230 tests. Release checks include the optimized build, TypeScript, icon validation, production migration permissions and financial record reconciliation. The accompanying pull request records final deployment and live smoke-check evidence.

No live charge, refund, payout, review submission or AI request is used as a test. Existing financial records and reviews must remain unchanged.

## Remaining external/operator acceptance

Real iPhone/Android permission dialogs, actual push receipt, offline/camera behavior, physical delivery confirmation, Stripe Connect KYC and authorized end-to-end payment/payout tests remain separate acceptance work. The three historical active driver assignments still require an operator to confirm physical status; they have not been arbitrarily completed or cancelled. The £26.25 historical payout is still pending. Previously documented Supabase plan/security advisory limitations remain recorded in the prior audit.
