"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateDeliveryStatus } from "@/app/actions/delivery"
import { CheckCircle } from "lucide-react"

const NEXT_STATUS: Record<string, { status: string; label: string }> = {
  accepted: { status: "collected", label: "Mark as Picked Up" },
  collected: { status: "in_transit", label: "Start Delivery" },
  in_transit: { status: "delivered", label: "Mark as Delivered" },
}

export function UpdateStatusButton({ jobId, currentStatus }: { jobId: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const next = NEXT_STATUS[currentStatus]

  if (!next) return null

  function handleClick() {
    startTransition(async () => {
      await updateDeliveryStatus(jobId, next.status)
      router.refresh()
      if (next.status === "delivered") {
        router.push("/dashboard/driver/jobs/completed")
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-60 transition-all"
    >
      <CheckCircle className="h-4 w-4" />
      {isPending ? "Updating…" : next.label}
    </button>
  )
}
