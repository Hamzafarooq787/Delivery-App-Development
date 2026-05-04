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
        console.log("[v0] acceptDelivery error:", result.error)
        alert(`Could not accept job: ${result.error}`)
        return
      }
      router.push("/dashboard/driver/active-jobs")
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleAccept}
      disabled={isPending}
      className="w-full py-2.5 bg-[#a3a6ff] text-[#0f00a4] font-bold text-sm rounded-lg transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
      style={{ boxShadow: "0px 0px 15px rgba(163,166,255,0.2)" }}
    >
      {isPending ? "Accepting..." : "Accept Job"}
    </button>
  )
}
