"use client";
import { useState } from "react";
import { createSandboxShoppingCard, fundShoppingCard } from "@/app/actions/shopping-operations";
export function ShoppingFundingPanel({
  id,
  reference,
  verified,
  problem,
  started,
  completed, canVerify, closed, sandbox,
}: {
  id: string;
  reference: string | null;
  verified: boolean;
  problem: string | null;
  started: string | null;
  completed: string | null;
  canVerify:boolean; closed:boolean; sandbox?:boolean;
}) {
  const [card, setCard] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const minutes =
    started && completed
      ? Math.round((Date.parse(completed) - Date.parse(started)) / 60000)
      : null;
  return (
    <section className="rounded-xl bg-[var(--brand-panel)] p-5 text-white space-y-3">
      <h2 className="font-bold">Shopping operations</h2>
      <p>
        {closed ? "Order cancelled. Shopping cannot start." : reference && verified
          ? "Company card verified for this order."
          : "A funded GBP Stripe Issuing card is required for the assigned driver before shopping starts."}
      </p>
      <p>
        Shopping duration:{" "}
        {minutes == null
          ? started
            ? "In progress"
            : "Not started"
          : `${minutes} minutes`}
      </p>
      {problem && <p role="alert">Driver report: {problem}</p>}
      {canVerify && !closed && <>{sandbox && <div className="rounded-lg border border-orange-400/30 p-3 space-y-2"><p className="text-sm">Stripe sandbox only. This creates a test card; funded Issuing balance is still required.</p><button disabled={busy} className="min-h-11 rounded-lg border border-white/20 px-3" onClick={async()=>{setBusy(true);try{const r=await createSandboxShoppingCard(id);if(r.cardId){setCard(r.cardId);setMessage("Test card created. Add test Issuing funds in Stripe, then verify company funding below.")}else setMessage(r.error??"Test card unavailable.")}catch{setMessage("Test card could not be created.")}finally{setBusy(false)}}}>Create sandbox purchase card</button></div>}<label className="block">
        Dedicated Stripe Issuing card reference
        <input
          value={card}
          onChange={(e) => setCard(e.target.value)}
          placeholder="ic_… (not a card number)"
          className="block w-full rounded bg-black/20 p-3"
        />
      </label>
      <button
        disabled={busy || !card}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fundShoppingCard(id, card);
            setMessage(r.error ?? "Company card verified.");
          } finally {
            setBusy(false);
          }
        }}
        className="rounded bg-[var(--brand-strong)] px-4 py-2"
      >
        {busy ? "Verifying…" : "Verify company funding"}
      </button>
      <p role="status">{message}</p></>}
      <p className="text-sm">
        Use a dedicated company card provided securely to the assigned driver.
        Never enter or store its card number here.
      </p>
    </section>
  );
}
