"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getPendingOrderCheckouts } from "@/app/actions/order-checkout";
export function PendingOrderCheckouts() {
  const path = usePathname(),
    [rows, setRows] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    let current = true;
    void getPendingOrderCheckouts().then((data) => {
      if (current) setRows(data);
    });
    return () => {
      current = false;
    };
  }, [path]);
  if (path !== "/dashboard/customer" || !rows.length) return null;
  return (
    <aside
      className="fixed left-3 right-3 top-16 z-40 rounded-xl bg-[var(--brand-panel)] p-3 text-sm text-white shadow-lg"
      aria-label="Unfinished payments"
    >
      {rows.map((row) => (
        <Link
          key={row.id}
          className="block p-2 underline"
          href={`/dashboard/customer/checkout?payment_id=${row.id}&canceled=1`}
        >
          Continue saved {row.label} checkout
        </Link>
      ))}
    </aside>
  );
}
export function ClearCompletedBookingDraft({ kind }: { kind: string }) {
  useEffect(() => {
    import("@/lib/supabase/client")
      .then(({ createClient }) => createClient().auth.getUser())
      .then(({ data: { user } }) => {
        if (user)
          try {
            sessionStorage.removeItem(`godrop-booking:${user.id}:${kind}`);
          } catch {}
      });
  }, [kind]);
  return null;
}
