import type Stripe from "stripe";

export type BankOperation = {
  account: string;
  state: string;
  started_at: string;
  transfer_started_at?: string;
  payout_started_at?: string;
  transfer_id?: string;
  payout_id?: string;
  error?: string;
  attempt?: number;
  history?: Array<Record<string, unknown>>;
};
type Dependencies = {
  stripe: Stripe;
  save: (operation: BankOperation) => Promise<void>;
  protectedPence: () => Promise<number>;
  now?: () => number;
};

// Stripe may discard an idempotency key after 24 hours. An uncertain operation
// outside this window needs reconciliation, never another blind create call.
export function canRetryCreate(at: string, now: number) {
  const age = now - Date.parse(at);
  return Number.isFinite(age) && age >= 0 && age < 20 * 60 * 60 * 1000;
}

export async function executeBankPayout(
  id: string,
  pounds: number,
  initial: BankOperation,
  deps: Dependencies,
) {
  const { stripe, save, protectedPence } = deps;
  const now = deps.now ?? Date.now;
  let op = { ...initial };
  const amount = Math.round(pounds * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("invalid_payout_amount");
  const options = { stripeAccount: op.account };
  const attempt = op.attempt ?? 0;
  if (!Number.isInteger(attempt) || attempt < 0) throw new Error("invalid_payout_attempt");
  const store = async (patch: Partial<BankOperation>) => {
    const next = { ...op, ...patch };
    await save(next);
    op = next;
  };
  const confirm = async (payout: Stripe.Payout) => {
    if (payout.amount !== amount || payout.currency !== "gbp" || payout.metadata?.godrop_payout !== id || Number(payout.metadata?.godrop_attempt ?? 0) !== attempt)
      throw new Error("bank_payout_mismatch");
    await store({ payout_id: payout.id, state: payout.status, error: payout.failure_code ?? undefined });
    return op;
  };

  // Always retrieve current provider state: late/out-of-order events cannot
  // overwrite a bank return with an old paid event.
  if (op.payout_id) return confirm(await stripe.payouts.retrieve(op.payout_id, {}, options));
  if (op.state === "failed" || op.state === "canceled") return op;

  const account = await stripe.v2.core.accounts.retrieve(op.account, { include: ["configuration.recipient"] });
  const capabilities = account.configuration?.recipient?.capabilities?.stripe_balance;
  if (capabilities?.stripe_transfers?.status !== "active" || capabilities?.payouts?.status !== "active")
    throw new Error("driver_bank_verification_required");
  await stripe.balanceSettings.update({ payments: { payouts: { schedule: { interval: "manual" } } } }, options);

  if (!op.transfer_id) {
    let transfer: Stripe.Transfer | undefined;
    if (op.transfer_started_at) {
      for await (const candidate of stripe.transfers.list({ transfer_group: `godrop:${id}`, destination: op.account, limit: 100 })) {
        if (candidate.metadata?.godrop_payout === id) {
          if (transfer) throw new Error("multiple_transfers_require_reconciliation");
          transfer = candidate;
        }
      }
    }
    if (!transfer) {
      if (op.transfer_started_at && !canRetryCreate(op.transfer_started_at, now()))
        throw new Error("uncertain_transfer_requires_reconciliation");
      const balance = await stripe.balance.retrieve();
      const available = balance.available.find(b => b.currency === "gbp")?.amount ?? 0;
      const reserve = await protectedPence();
      if (!Number.isSafeInteger(reserve) || reserve < 0 || available - reserve < amount)
        throw new Error("insufficient_service_funds_shopping_money_protected");
      if (!op.transfer_started_at) await store({ transfer_started_at: new Date(now()).toISOString() });
      transfer = await stripe.transfers.create({
        amount, currency: "gbp", destination: op.account,
        transfer_group: `godrop:${id}`, metadata: { godrop_payout: id },
      }, { idempotencyKey: `godrop:transfer:${id}` });
    }
    if (transfer.amount !== amount || transfer.currency !== "gbp" || transfer.destination !== op.account || transfer.reversed)
      throw new Error("transfer_mismatch_requires_reconciliation");
    await store({ transfer_id: transfer.id, state: "awaiting_bank_payout", error: undefined });
  }

  const funded = await stripe.transfers.retrieve(op.transfer_id!);
  if (funded.amount !== amount || funded.currency !== "gbp" || funded.destination !== op.account || funded.reversed || funded.amount_reversed > 0)
    throw new Error("transfer_reversed_requires_reconciliation");

  let payout: Stripe.Payout | undefined;
  if (op.payout_started_at) {
    for await (const candidate of stripe.payouts.list({ created: { gte: Math.floor(Date.parse(op.payout_started_at) / 1000) - 60 }, limit: 100 }, options)) {
      if (candidate.metadata?.godrop_payout === id && Number(candidate.metadata?.godrop_attempt ?? 0) === attempt) {
        if (payout) throw new Error("multiple_bank_payouts_require_reconciliation");
        payout = candidate;
      }
    }
  }
  if (!payout) {
    if (op.payout_started_at && !canRetryCreate(op.payout_started_at, now()))
      throw new Error("uncertain_bank_payout_requires_reconciliation");
    const balance = await stripe.balance.retrieve({}, options);
    if ((balance.available.find(b => b.currency === "gbp")?.amount ?? 0) < amount)
      throw new Error("waiting_for_connected_balance");
    if (!op.payout_started_at) await store({ payout_started_at: new Date(now()).toISOString() });
    payout = await stripe.payouts.create({ amount, currency: "gbp", method: "standard", metadata: { godrop_payout: id, godrop_attempt: String(attempt) } }, {
      ...options, idempotencyKey: attempt === 0 ? `godrop:bank:${id}` : `godrop:bank:${id}:${attempt}`,
    });
  }
  return confirm(payout);
}
