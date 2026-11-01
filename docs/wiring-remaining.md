# Remaining wiring repairs: findings 10–18

## Implemented

| Finding | Result |
| --- | --- |
| 10: assignment/cancellation alerts | Transactional recipient-specific notices cover same-status reassignment, safety release, replacement matching, cancellation and completion. Old/new drivers and the customer receive the appropriate dashboard link. |
| 11: missing notice links | Current events carry exact order/ticket references. Historical links are reconstructed only from unambiguous references and allowed recipients. Unverifiable/outdated order notices are labelled unavailable and cannot navigate to an unrelated order. Legacy chat notices retain their chat-inbox fallback. |
| 12: unsuitable job notices | Both in-app and push matching share a service-only database selector: confirmed payment, current driver mode, active account, approval, online/idle state, valid required documents, vehicle capacity and alert preference. New claims also reject incomplete compliance. |
| 13: support alerts/unread | Saved requests/replies/status changes create durable linked notices. Replies increment the correct unread counter; read watermarks preserve messages arriving after a page fetch. Retry keys are scoped to the ticket. Push supplements the saved in-app event. |
| 14: support filters | Polling refreshes the current server route, preserving search, status and pagination. Exact ticket links open the authorised conversation. |
| 15: incomplete timelines | Database triggers record state/assignment events atomically, including driver self-acceptance. Legacy duplicate inserts are suppressed. Reconstructed historical acceptance has an explicitly unknown occurrence time. All three panels format actual timestamps consistently in UK time. |
| 16: operational availability | Customer Home reflects service switches and UK opening hours/holidays without showing an initial false disabled state. Unknown configuration is distinct from a deliberately paused service. Booking still rechecks settings server-side. |
| 17: expired waiting checkout | The same approved payment is retained. A new versioned checkout attempt requires verified provider expiry/unpaid state. Open/paid sessions are reused/reconciled. Uncertain creation is searched at the provider before retry, with conservative limits and no blind second charge. |
| 18: waiting refund visibility | Order details show booking and waiting payments separately, each with its relevant refund controls. Waiting refund requests are scoped, audited, idempotent and bounded by their own remaining budget. Related-payment failures/refunds link to the correct order in the attention queue. |

## Additional confirmed repairs

- Cancellation after a partial waiting refund queues only the remaining refundable amount.
- Replacement drivers do not inherit unapproved waiting timers; the old timer is retained in operator history. Approved charges keep the original waiting driver.
- Approved waiting charges remain payable after pickup; cancelled orders cannot reopen checkout.
- Support creation rejects blank/oversized requests, including the legacy booking action; missing support records no longer report false status-update success.
- Notification content/link fields and support reply metadata cannot be forged by browser roles. Users can still mark their own notices read.
- Pending waiting payments cannot appear as saved booking-resume links.
- Obsolete GPS is cleared; assignment changes clear the previous job position.
- Admin order conversations show the saved participant label correctly.

## Verification and boundaries

Run the complete regression suite, production build, TypeScript and icon validation, then apply `20261101043251_wiring_remaining.sql` before deployment. Tests cover matching, event recipients, support concurrency/unread state, historical events, provider state recovery, waiting refund budgets and role permissions with synthetic records.

No real charge, refund, bank payout, invitation or outbound message is used as a test. Historical order/financial assignments remain unchanged. Three old overlapping physical jobs still require operator confirmation, as documented in `wiring-first-nine.md`. Live provider, physical-device and bank-payout acceptance remain separate from these automated checks.

## Live migration results

The migration applied successfully. Of 98 retained historical notices, 64 now have verified record links, 29 unverifiable/outdated order notices are marked unavailable, and five legacy chat notices retain their inbox behavior. Eight historical acceptance events are reconstructed with explicitly unknown occurrence times; acceptance-log gaps are zero. The obsolete GPS count is zero.

Order, paid-payment, earnings and payout counts are unchanged. Wallet totals and transaction counts are unchanged. No new notification was sent by the data repair. Browser roles can update their notice read flag but cannot edit notice content; privileged new RPCs remain service-only. Security-advisor counts are unchanged.

Verification includes the existing regression coverage and 26 additional wiring tests for this batch. A full 198-test run and all 26 targeted tests passed; the final combined suite includes the last provider compatibility test as well. Production build, TypeScript, icons and diff checks are required for the exact release commit.
