"use client";
import { useState } from "react";
export function PriceBreakdown({
  lines,
}: {
  lines: { label: string; amount: number }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs underline"
      >
        View price breakdown
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Price breakdown"
        >
          <section className="w-full max-w-sm rounded-2xl bg-[var(--brand-panel)] p-5 text-white">
            <h3 className="mb-4 font-bold">Delivery price breakdown</h3>
            {lines.map((line, i) => (
              <p className="flex justify-between gap-3 py-2 text-sm" key={i}>
                <span>{line.label}</span>
                <strong>
                  {line.amount < 0 ? "−" : ""}£
                  {Math.abs(line.amount).toFixed(2)}
                </strong>
              </p>
            ))}
            <button
              type="button"
              autoFocus
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-xl bg-[var(--brand-strong)] p-3"
            >
              Back to review
            </button>
          </section>
        </div>
      )}
    </>
  );
}
