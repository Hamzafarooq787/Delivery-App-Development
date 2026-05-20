"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { requestDriverPayout } from "@/app/actions/payouts"

export function RequestPayoutButton({ pendingBalance }: { pendingBalance: number }) {
  const [isPending, startTransition] = useTransition()

  function handleRequest() {
    if (pendingBalance <= 0) {
      toast.error("No balance available to withdraw")
      return
    }
    startTransition(async () => {
      const res = await requestDriverPayout()
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Payout of £${(res.amount ?? 0).toFixed(2)} requested successfully!`)
      }
    })
  }

  return (
    <button
      onClick={handleRequest}
      disabled={isPending || pendingBalance <= 0}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all
        bg-[#a3a6ff] text-[#0f00a4] hover:brightness-110 active:scale-95
        disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ boxShadow: pendingBalance > 0 ? "0px 0px 16px rgba(163,166,255,0.35)" : undefined }}
    >
      <span className="material-symbols-outlined text-lg">
        {isPending ? "progress_activity" : "payments"}
      </span>
      {isPending ? "Requesting…" : "Request Payout"}
    </button>
  )
}
