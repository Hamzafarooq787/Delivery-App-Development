"use client"

import { useState, useTransition } from "react"
import { adminCancelOrder, adminIssueRefund } from "@/app/actions/wallet"
import { AssignDriverDropdown, type DriverOption } from "@/components/admin/assign-driver-dropdown"

function Spinner() {
  return (
    <svg className="animate-spin w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

export function OrderActionsPanel({
  orderId,
  orderStatus,
  currentDriverId,
  drivers,
}: {
  orderId: string
  orderStatus: string
  currentDriverId: string | null
  drivers: DriverOption[]
}) {
  const canCancel = !["delivered", "cancelled"].includes(orderStatus)

  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showRefundInput, setShowRefundInput] = useState(false)
  const [refundAmount, setRefundAmount] = useState("")
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const [cancelPending, startCancel] = useTransition()
  const [refundPending, startRefund] = useTransition()

  function flash(text: string, ok: boolean) {
    setMessage({ text, ok })
    setTimeout(() => setMessage(null), 4000)
  }

  function handleCancel() {
    startCancel(async () => {
      const result = await adminCancelOrder(orderId)
      setShowCancelConfirm(false)
      if (result.error) {
        flash(result.error, false)
      } else {
        flash(
          result.refunded
            ? `Order cancelled. £${result.refundAmount?.toFixed(2)} refunded to customer.`
            : "Order cancelled.",
          true
        )
      }
    })
  }

  function handleRefund() {
    const amount = parseFloat(refundAmount)
    if (!amount || amount <= 0) {
      flash("Enter a valid amount", false)
      return
    }
    startRefund(async () => {
      const result = await adminIssueRefund(orderId, amount)
      setShowRefundInput(false)
      setRefundAmount("")
      if (result.error) {
        flash(result.error, false)
      } else {
        flash(`£${amount.toFixed(2)} refunded to customer.`, true)
      }
    })
  }

  return (
    <div className="space-y-2">
      {/* Feedback */}
      {message && (
        <div className={`text-xs px-3 py-2 rounded-lg font-medium ${message.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
          {message.text}
        </div>
      )}

      {/* Assign Driver */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#201f1f] rounded-lg border border-[#494847]/10">
        <div className="flex items-center gap-2 text-sm text-white">
          <span className="material-symbols-outlined text-sm text-[#a3a6ff]">person_add</span>
          Assign Driver
        </div>
        <AssignDriverDropdown
          deliveryId={orderId}
          currentDriverId={currentDriverId}
          drivers={drivers}
        />
      </div>

      {/* Cancel Order */}
      {canCancel && (
        <>
          {showCancelConfirm ? (
            <div className="px-4 py-3 bg-red-500/5 rounded-lg border border-red-500/20 space-y-2">
              <p className="text-xs text-red-400 font-medium">Cancel this order? The customer will be refunded the full amount.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={cancelPending}
                  onClick={handleCancel}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-semibold border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50"
                >
                  {cancelPending ? <Spinner /> : <span className="material-symbols-outlined text-xs">check</span>}
                  Confirm
                </button>
                <button
                  type="button"
                  disabled={cancelPending}
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#201f1f] text-[#adaaaa] rounded-lg text-xs font-semibold border border-[#494847]/10 hover:bg-[#262626] transition-all"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                  Back
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#201f1f] text-white rounded-lg text-sm border border-[#494847]/10 hover:bg-[#262626] transition-all"
            >
              <span className="material-symbols-outlined text-sm text-red-400">cancel</span>
              Cancel Order
            </button>
          )}
        </>
      )}

      {/* Issue Refund */}
      {showRefundInput ? (
        <div className="px-4 py-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20 space-y-2">
          <p className="text-xs text-emerald-400 font-medium">Enter refund amount (£)</p>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            className="w-full px-3 py-1.5 bg-[#131313] border border-[#494847]/20 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/40"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={refundPending}
              onClick={handleRefund}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-semibold border border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
            >
              {refundPending ? <Spinner /> : <span className="material-symbols-outlined text-xs">payments</span>}
              Issue
            </button>
            <button
              type="button"
              disabled={refundPending}
              onClick={() => { setShowRefundInput(false); setRefundAmount("") }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#201f1f] text-[#adaaaa] rounded-lg text-xs font-semibold border border-[#494847]/10 hover:bg-[#262626] transition-all"
            >
              <span className="material-symbols-outlined text-xs">close</span>
              Back
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowRefundInput(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#201f1f] text-white rounded-lg text-sm border border-[#494847]/10 hover:bg-[#262626] transition-all"
        >
          <span className="material-symbols-outlined text-sm text-emerald-400">payments</span>
          Issue Refund
        </button>
      )}
    </div>
  )
}
