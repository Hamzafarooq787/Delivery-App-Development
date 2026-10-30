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
        res = await markPayoutPaid(payoutId, window.prompt("Enter the verified bank payment reference. Only confirm after the transfer is complete.") ?? undefined)
      } else if (driverId) {
        res = await adminProcessDriverPayout(driverId)
      } else {
        return
      }

      if (res.error) {
        toast.error(res.error)
      } else {
        const paid = res.amount ?? amount
        toast.success(markExisting ? `£${paid.toFixed(2)} bank payment recorded` : `£${paid.toFixed(2)} reserved for payout; no money sent`)
      }
    })
  }

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[var(--brand-strong)]/10 text-[var(--brand-soft)] hover:bg-[var(--brand-strong)]/20 border border-[var(--brand-strong)]/20 transition-all disabled:opacity-50 whitespace-nowrap"
    >
      {isPending ? "Processing…" : markExisting ? "Record bank payment" : "Reserve payout"}
    </button>
  )
}

/**
 * Button to mark ALL pending payout rows as paid at once.
 */
export function ProcessAllButton({count}:{count:number}){return <p className="text-xs text-white">{count} awaiting review. Confirm each bank payment separately.</p>}
