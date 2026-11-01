# Customer, driver and admin wiring: findings 1–9

## Repairs

1. Restore driver dashboard mode only for approved, active accounts with existing active assignments. Retain customer history and all physical jobs. Open admin recovery reviews for historical parallel assignments; new concurrent claims remain blocked. **The existing three-job physical workload still needs operator confirmation before any assignment is released or changed.**
2. Rebuild a missing wallet payment only from one matching original deduction owned by that order's customer, with the exact amount and no refund/conflicting payment. Keep the historical ledger reference and original payment date; never debit the wallet again.
3. Reconstruct missing delivered-order earnings from confirmed wallet payments and the stored driver quote or original historical 75% rule. Refuse ambiguous prior payouts. Record evidence and create no bank payout. Block future completion without confirmed payment.
4. Enforce active-account, Support scope and required MFA checks on support reply actions; duplicate the staff-scope check inside the service-only SQL function.
5. Apply scope/MFA checks before all three media endpoints mint signed URLs. Driver verification documents require Operations; delivery/order media allow Operations or Support. Retain authenticated ownership and participant checks. The database photo predicate also respects scopes.
6. Include separately paid waiting fees and their refunds in customer payment history, totals, receipts and order links.
7. Credit waiting fees to the immutable driver recorded when the fee was approved for checkout, even if the delivery is subsequently reassigned. Preserve duplicate protection.
8. Rejection of driver clearance opens linked handover cases and durable alerts. Existing jobs remain accessible for support/acknowledgement, ordinary forward driving/shopping transitions are blocked, and no job is silently cancelled or unassigned.
9. Show fixed, public recovery instructions on customer tracking and both driver job flows. Keep private admin case notes private. Return instructions block ordinary delivery progression. Versioned, idempotent driver acknowledgements appear in the admin case with visible-page refresh.

## Validation and release boundaries

Use synthetic database fixtures for transaction/permission tests, plus route/action tests for signed URL and support checks. Run the existing regression suite, TypeScript, icon checks and production build. Apply `20261101041915_wiring_first_nine.sql` before publishing the application, then check live finance gaps, role alignment, assignment preservation and RPC permissions.

No live card charge, wallet debit, bank payout, invitation or outbound message is used as a test. Historical data repairs and their evidence are recorded in the audit log. Automatic bank payouts remain disabled. Real provider and device acceptance remain separate. Findings 10–18 are outside this batch except where shared code is needed for findings 1–9.

## Live migration verification

The migration applied successfully. Delivered orders without paid records: 1 → 0. Delivered orders without earnings: 2 → 0. Restored driver earnings total: £32.85; total recorded earnings: £59.10. Active orders assigned to customer-mode accounts: 3 → 0. The missing payment is restored from its original matching wallet ledger entry, with no new wallet debit.

All 20 orders and their driver/status assignments are preserved. Wallet ledger rows remain 36 and total wallet balance remains £918.25. Existing payout rows remain one; no bank payment is sent. Three historical parallel jobs are explicitly flagged for operator review, and no additional job can be claimed by that busy driver. Database security-advisor counts are unchanged.

Validation: the full 172-test regression run passed before the final historical-data test was added; all 14 new wiring tests then passed against the final migration. The production build, TypeScript, icon checks and diff validation passed.
