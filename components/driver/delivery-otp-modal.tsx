"use client"

import { useState, useTransition } from "react"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { verifyDeliveryOtpAndComplete } from "@/app/actions/delivery"

type Props = {
  deliveryId: string
  onClose: () => void
  onSuccess: () => void
}

export function DeliveryOtpModal({ deliveryId, onClose, onSuccess }: Props) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    if (code.length !== 4 || isPending) return
    setError(null)
    startTransition(async () => {
      const result = await verifyDeliveryOtpAndComplete(deliveryId, code)
      if (result.error) {
        setError(result.error)
        setCode("")
        return
      }
      onSuccess()
    })
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { if (!isPending) onClose() }} />
      <div className="relative w-full max-w-sm bg-[#1a1919] border border-[#494847]/20 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#494847]/15">
          <h2 className="text-base font-bold text-white">Confirm Delivery</h2>
          <button onClick={onClose} disabled={isPending} className="text-[#adaaaa] hover:text-white disabled:opacity-40">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="px-6 py-6 space-y-5 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#6ee7b7]/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#6ee7b7] text-2xl">password</span>
          </div>
          <p className="text-sm text-[#adaaaa] leading-relaxed">
            Ask the customer for their 4-digit delivery code and enter it below to confirm handoff.
          </p>
          <div className="flex justify-center">
            <InputOTP
              maxLength={4}
              value={code}
              onChange={setCode}
              disabled={isPending}
              onComplete={handleSubmit}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="w-12 h-14 text-lg" />
                <InputOTPSlot index={1} className="w-12 h-14 text-lg" />
                <InputOTPSlot index={2} className="w-12 h-14 text-lg" />
                <InputOTPSlot index={3} className="w-12 h-14 text-lg" />
              </InputOTPGroup>
            </InputOTP>
          </div>
          {error && <p className="text-xs text-[#ff6e84]">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-[#494847]/15 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={code.length !== 4 || isPending}
            className="px-5 py-2.5 rounded-xl bg-[#6ee7b7] text-[#052e16] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40"
          >
            {isPending ? "Verifying…" : "Confirm Delivery"}
          </button>
        </div>
      </div>
    </div>
  )
}
