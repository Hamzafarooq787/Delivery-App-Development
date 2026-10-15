"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { acceptDelivery } from "@/app/actions/delivery"

export function AcceptJobButton({ deliveryId }: { deliveryId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleAccept = () => {
    startTransition(async () => {
      const result = await acceptDelivery(deliveryId)
      if (result?.error) {
        alert(`Could not accept job: ${result.error}`)
        return
      }
      // Navigate to the job detail page — DriverLocationBroadcaster
      // is already mounted there and will auto-start GPS broadcasting.
      router.push(`/dashboard/driver/jobs/${deliveryId}`)
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleAccept}
      disabled={isPending}
      className="w-full py-2.5 bg-[var(--brand-strong)] text-[var(--brand-ink)] font-bold text-sm rounded-lg transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      style={{ boxShadow: "0px 0px 15px rgba(var(--brand-rgb),0.2)" }}
    >
      <span className="material-symbols-outlined text-base">
        {isPending ? "hourglass_empty" : "check_circle"}
      </span>
      {isPending ? "Accepting..." : "Accept Job"}
    </button>
  )
}

