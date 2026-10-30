"use client";
import { useState } from "react";
export function AddressInstructions({
  pickup,
  delivery,
  onPickup,
  onDelivery,
}: {
  pickup: string;
  delivery: string;
  onPickup: (v: string) => void;
  onDelivery: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="min-h-9 text-xs underline"
        onClick={() => setOpen(true)}
      >
        Add flat, entrance or access instructions
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Access instructions"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3"
        >
          <section className="w-full max-w-md space-y-3 rounded-xl bg-[var(--brand-panel)] p-4 text-white">
            <h3 className="font-bold">Access instructions</h3>
            <label className="block text-sm">
              Pickup / shop
              <textarea
                maxLength={500}
                rows={2}
                value={pickup}
                onChange={(e) => onPickup(e.target.value)}
                className="mt-1 w-full rounded bg-black/20 p-2"
                placeholder="Flat number, entrance, collection desk…"
              />
            </label>
            <label className="block text-sm">
              Delivery
              <textarea
                maxLength={500}
                rows={2}
                value={delivery}
                onChange={(e) => onDelivery(e.target.value)}
                className="mt-1 w-full rounded bg-black/20 p-2"
                placeholder="Building, entrance, doorbell…"
              />
            </label>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded-xl bg-[var(--brand-strong)] p-3"
            >
              Save instructions
            </button>
          </section>
        </div>
      )}
    </>
  );
}
