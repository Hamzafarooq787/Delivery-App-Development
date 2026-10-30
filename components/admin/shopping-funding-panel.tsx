"use client";
import { useState } from "react";
import { fundShoppingCard } from "@/app/actions/shopping-operations";
export function ShoppingFundingPanel({
  id,
  reference,
  verified,
  problem,
  started,
  completed,
}: {
  id: string;
  reference: string | null;
  verified: boolean;
  problem: string | null;
  started: string | null;
  completed: string | null;
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
        {reference && verified
          ? "Company card verified for this order."
          : "Company card required before shopping starts."}
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
      <label className="block">
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
      <p role="status">{message}</p>
      <p className="text-sm">
        Use a dedicated company card provided securely to the assigned driver.
        Never enter or store its card number here.
      </p>
    </section>
  );
}
