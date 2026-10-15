"use client"

import { useState, useTransition } from "react"
import { previewCancellationFee, cancelOrder } from "@/app/actions/wallet"

type Props = {
  deliveryId: string
  currentStatus: string
  onCancelled?: () => void
}

export function CancelOrderButton({ deliveryId, currentStatus, onCancelled }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showModal, setShowModal] = useState(false)
  const [preview, setPreview] = useState<{
    freeCancel: boolean
    cancellationFee: number
    distanceMiles: number
    status: string
    canCancel: boolean
    directPayment?: boolean
  } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  // Don't show button for terminal statuses
  if (["delivered", "cancelled"].includes(currentStatus)) return null

  function handleOpenModal() {
    startTransition(async () => {
      const data = await previewCancellationFee(deliveryId)
      setPreview(data)
      setShowModal(true)
    })
  }

  function handleConfirm() {
    setConfirming(true)
    startTransition(async () => {
      const res = await cancelOrder(deliveryId)
      if (res.success) {
        setResult({
          success: true,
          message: res.freeCancel
            ? res.refundAmount > 0
              ? res.refundDestination === "card" ? "Order cancelled. The refund was requested to your original payment card." : `Order cancelled. £${res.refundAmount.toFixed(2)} refunded to your wallet.`
              : "Order cancelled successfully. No charge applied."
            : `Order cancelled. £${res.cancellationFee} cancellation fee deducted from your wallet.`,
        })
        setTimeout(() => {
          setShowModal(false)
          setResult(null)
          setPreview(null)
          setConfirming(false)
          onCancelled?.()
        }, 2000)
      } else {
        setResult({ success: false, message: res.error ?? "Failed to cancel order." })
        setConfirming(false)
      }
    })
  }

  return (
    <>
      <button
        onClick={handleOpenModal}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#ff6e84]/30 text-[#ff6e84] text-xs font-bold hover:bg-[#ff6e84]/10 transition-all disabled:opacity-50 active:scale-95"
      >
        <span className="material-symbols-outlined text-sm">cancel</span>
        Cancel Order
      </button>

      {showModal && preview && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { if (!confirming) { setShowModal(false); setPreview(null); setResult(null) } }} />
          <div className="relative w-full max-w-md bg-[#1a1919] border border-[#494847]/20 rounded-2xl overflow-hidden shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#494847]/15">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${preview.freeCancel ? "bg-[#6ee7b7]/10" : "bg-[#ff6e84]/10"}`}>
                  <span className={`material-symbols-outlined text-lg ${preview.freeCancel ? "text-[#6ee7b7]" : "text-[#ff6e84]"}`}>
                    {preview.freeCancel ? "check_circle" : "warning"}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white">Cancel Order</h2>
              </div>
              {!confirming && (
                <button onClick={() => { setShowModal(false); setPreview(null); setResult(null) }} className="text-[#adaaaa] hover:text-white">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              )}
            </div>

            <div className="px-5 py-5 space-y-4">
              {result ? (
                <div className={`rounded-xl p-4 flex items-center gap-3 ${result.success ? "bg-[#6ee7b7]/10 border border-[#6ee7b7]/20" : "bg-[#ff6e84]/10 border border-[#ff6e84]/20"}`}>
                  <span className={`material-symbols-outlined ${result.success ? "text-[#6ee7b7]" : "text-[#ff6e84]"}`}>
                    {result.success ? "check_circle" : "error"}
                  </span>
                  <p className="text-sm font-semibold text-white">{result.message}</p>
                </div>
              ) : (
                <>
                  {preview.freeCancel ? (
                    <div className="bg-[#6ee7b7]/10 border border-[#6ee7b7]/20 rounded-xl p-4 flex items-start gap-3">
                      <span className="material-symbols-outlined text-[#6ee7b7] text-xl mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <div>
                        <p className="text-sm font-bold text-white">Free Cancellation</p>
                        <p className="text-xs text-[#adaaaa] mt-1 leading-relaxed">
                          {preview.directPayment ? "Before driver acceptance you can cancel for free. Any refund returns to the original payment card." : "The driver has not started the journey yet. You can cancel this order at no charge."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-[#ff6e84] text-xl mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                        <div>
                          <p className="text-sm font-bold text-white">Cancellation Fee Applies</p>
                          <p className="text-xs text-[#adaaaa] mt-1 leading-relaxed">
                            The driver has already started the journey. A fee of <strong className="text-white">£{preview.cancellationFee}</strong> will be deducted from your wallet.
                          </p>
                        </div>
                      </div>
                      <div className="bg-[#262626] rounded-xl p-3 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-[#adaaaa]">Distance</span>
                          <span className="text-white font-semibold">{preview.distanceMiles > 0 ? `${preview.distanceMiles.toFixed(1)} miles` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[#adaaaa]">Rate</span>
                          <span className="text-white font-semibold">£1.00 / mile</span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-[#494847]/20 pt-2 font-bold">
                          <span className="text-[#adaaaa]">Cancellation Fee</span>
                          <span className="text-[#ff6e84]">£{preview.cancellationFee}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-[#adaaaa] bg-[#262626] rounded-xl px-4 py-3 leading-relaxed">
                    {preview.canCancel ? "Are you sure you want to cancel this order?" : "The driver has accepted this job. Contact support for cancellation and refund review."}
                  </p>

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => { setShowModal(false); setPreview(null) }}
                      disabled={confirming}
                      className="flex-1 py-3 rounded-xl bg-[#262626] text-[#adaaaa] font-semibold text-sm hover:text-white transition-colors disabled:opacity-50"
                    >
                      Keep Order
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={confirming || !preview.canCancel}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                        preview.freeCancel
                          ? "bg-[#6ee7b7] text-[#052e16] hover:brightness-110"
                          : "bg-[#ff6e84] text-white hover:brightness-110"
                      }`}
                    >
                      {confirming ? (
                        <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Cancelling…</>
                      ) : (
                        preview.freeCancel ? "Cancel for Free" : `Pay £${preview.cancellationFee} & Cancel`
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

