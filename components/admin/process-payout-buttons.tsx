"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { markPayoutPaid, markAllPayoutsPaid, adminProcessDriverPayout } from "@/app/actions/payouts"

/**
 * Button for admin to process a payout.
 * - markExisting=true: marks an existing payouts row as paid (by payoutId)
 * - markExisting=false: processes a driver's pending earnings (by driverId)
 */
export function ProcessPayoutButton({
  payoutId,
  driverId,
  amount,
  markExisting = false,
}: {
  payoutId?: string
  driverId?: string
  amount: number
  markExisting?: boolean
}) {
  const [isPending, startTransition] = useTransition()

  function handle() {
    startTransition(async () => {
      let res: { error?: string; success?: boolean; amount?: number }

      if (markExisting && payoutId) {
        res = await markPayoutPaid(payoutId)
      } else if (driverId) {
        res = await adminProcessDriverPayout(driverId)
      } else {
        return
      }

      if (res.error) {
        toast.error(res.error)
      } else {
        const paid = res.amount ?? amount
        toast.success(`£${paid.toFixed(2)} disbursed successfully`)
      }
    })
  }

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[var(--brand-strong)]/10 text-[var(--brand-soft)] hover:bg-[var(--brand-strong)]/20 border border-[var(--brand-strong)]/20 transition-all disabled:opacity-50 whitespace-nowrap"
    >
      {isPending ? "Processing…" : "Process"}
    </button>
  )
}

/**
 * Button to mark ALL pending payout rows as paid at once.
 */
export function ProcessAllButton({ count }: { count: number }) {
  const [isPending, startTransition] = useTransition()

  function handle() {
    startTransition(async () => {
      const res = await markAllPayoutsPaid()
      if (res.error) toast.error(res.error)
      else toast.success(`All ${count} pending payouts marked as disbursed`)
    })
  }

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[var(--brand-strong)] text-[var(--brand-ink)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
      style={{ boxShadow: "0px 0px 16px rgba(var(--brand-rgb),0.25)" }}
    >
      <span className="material-symbols-outlined text-lg">
        {isPending ? "progress_activity" : "done_all"}
      </span>
      {isPending ? "Processing…" : `Process All (${count})`}
    </button>
  )
}

