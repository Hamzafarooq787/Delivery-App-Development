"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  retryOrderRefunds,
  adminRefundCardOrder,
} from "@/app/actions/order-checkout";
type Refund = {
  key: string;
  amount: number;
  state: string;
  stripe_refund_id?: string;
};
export function OrderPaymentPanel({
  id,
  amount,
  status,
  refunds,
}: {
  id: string;
  amount: number;
  status: string;
  refunds: Refund[];
}) {
  const requestKey = useRef<string | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <section className="rounded-xl border border-white/10 p-5 text-white space-y-3">
      <h2 className="font-bold">Card payment and refunds</h2>
      <p>
        Customer payment: £{Number(amount).toFixed(2)} · {status}
      </p>
      {refunds.length === 0 ? (
        <p>No refund requested.</p>
      ) : (
        refunds.map((r) => (
          <p key={r.key}>
            {r.key}: £{Number(r.amount).toFixed(2)} — {r.state}
            {["failed", "canceled", "requires_action"].includes(r.state)
              ? " · Action required in Stripe"
              : ""}
          </p>
        ))
      )}
      {refunds.some((r) => r.state === "pending") && (
        <button
          className="rounded bg-[var(--brand-strong)] px-4 py-2"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await retryOrderRefunds(id);
              setMessage(result.error ?? "Refund status refreshed.");
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        >
          Reconcile pending refunds
        </button>
      )}
      <div className="border-t border-white/10 pt-3">
        <label>
          Refund amount (£)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={refundAmount}
            onChange={(e) => {
              setRefundAmount(e.target.value);
              requestKey.current = null;
            }}
            className="ml-2 w-28 rounded bg-black/20 p-2"
          />
        </label>
        <label className="block">
          Reason
          <input
            value={reason}
            maxLength={500}
            onChange={(e) => {
              setReason(e.target.value);
              requestKey.current = null;
            }}
            className="my-2 w-full rounded bg-black/20 p-2"
          />
        </label>
        <button
          disabled={busy || !reason || !refundAmount}
          className="rounded bg-[var(--brand-strong)] px-4 py-2"
          onClick={async () => {
            setBusy(true);
            requestKey.current ??= crypto.randomUUID();
            try {
              const result = await adminRefundCardOrder(
                id,
                Number(refundAmount),
                reason,
                requestKey.current,
              );
              setMessage(
                result.error ??
                  "Refund requested to the original payment card.",
              );
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        >
          Refund to original card
        </button>
      </div>
      <p role="status">{message}</p>
    </section>
  );
}
