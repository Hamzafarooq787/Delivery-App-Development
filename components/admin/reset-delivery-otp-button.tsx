"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { adminResetDeliveryOtp } from "@/app/actions/delivery"

export function ResetDeliveryOtpButton({ deliveryId }: { deliveryId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (isPending) return
    startTransition(async () => {
      const result = await adminResetDeliveryOtp(deliveryId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("A new delivery code was generated. The customer can see it on their tracking page.")
    })
  }

  return (
    <Button variant="outline" className="w-full" size="sm" onClick={handleClick} disabled={isPending}>
      {isPending ? "Resetting…" : "Reset Delivery Code"}
    </Button>
  )
}
