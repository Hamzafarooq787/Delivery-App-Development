"use client";
import { useState, useTransition } from "react";
import { setAutomaticPayouts } from "@/app/actions/bank-payouts";
export function AutomaticPayoutsControl({ enabled, webhookConfigured }: { enabled: boolean; webhookConfigured: boolean }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  return <section className="mx-4 md:mx-8 my-4 p-5 rounded-xl bg-[var(--brand-panel)] text-white border border-white/15">
    <h3 className="font-bold">Automatic weekly bank payouts: {enabled ? "Enabled" : "Paused"}</h3>
    <p className="text-sm my-2">Monday earnings reservations are processed for verified driver bank accounts. Bank status is checked daily. Transfers and bank payouts have separate references; only confirmed bank payouts are marked paid.</p>
    <p className="text-sm mb-3">{webhookConfigured ? "Connect webhook secret configured; event delivery still needs provider verification." : "Connect webhook is not configured. Daily reconciliation is available; instant bank status updates need Stripe setup."}</p>
    <p className="text-sm mb-3">Keep payouts paused until Stripe Connect and a test payout have been verified. Goods funds and refund reserves are excluded from available payout funds. Failed or uncertain payments need reconciliation before retry.</p>
    <button disabled={busy} className="px-4 py-2 rounded-lg bg-[var(--brand-strong)] text-[var(--brand-ink)] font-bold disabled:opacity-50" onClick={() => start(async () => {
      setError("");
      try { const result = await setAutomaticPayouts(!enabled); if (result.error) setError(result.error); }
      catch { setError("Unable to save. Please retry."); }
    })}>{busy ? "Saving…" : enabled ? "Pause automatic payments" : "Enable automatic payments"}</button>
    {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}
  </section>;
}
