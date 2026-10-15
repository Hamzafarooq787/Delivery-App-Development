'use client'
import { useEffect, useState } from 'react'
import {
  getCustomerShoppingApprovals,
  approveCustomerShoppingChange,
} from '@/app/actions/shopping-approvals'
import { respondToSubstitution } from '@/app/actions/shopping'
type Request = {
  id: string
  suggested_name: string
  suggested_price: number | null
  driver_notes: string | null
}
export function ShoppingApprovalsPanel({ deliveryId }: { deliveryId: string }) {
  const [requests, setRequests] = useState<Request[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    const refresh = () => {
      if (document.visibilityState === 'visible')
        getCustomerShoppingApprovals(deliveryId)
          .then((r) => {
            if (active) setRequests(r.data as Request[])
          })
          .catch(() => {})
    }
    refresh()
    const timer = setInterval(refresh, 5000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [deliveryId])
  if (!requests.length && !message) return null
  return (
    <section className="rounded-xl bg-[#242424] border border-orange-300 p-4 text-white space-y-3">
      <h3 className="font-bold">Your driver needs approval</h3>
      {requests.map((r) => (
        <div key={r.id} className="rounded-lg border border-gray-500 p-3">
          <p>
            {r.suggested_name} ·{' '}
            {r.suggested_price == null
              ? 'Ask your driver for the price'
              : `£${Number(r.suggested_price).toFixed(2)} per unit`}
          </p>
          <p className="text-sm">{r.driver_notes}</p>
          <p className="text-xs mt-2">
            If this raises the total above your funded budget, Stripe will show
            the extra purchase funds before you pay. No extra service fee.
          </p>
          <div className="flex gap-3 mt-3">
            <button
              disabled={busy || r.suggested_price == null}
              className="bg-[var(--color-primary)] text-black p-2 rounded-lg font-bold"
              onClick={async () => {
                setBusy(true)
                try {
                  const result = await approveCustomerShoppingChange(r.id)
                  if ('url' in result && result.url)
                    window.location.assign(result.url)
                  else if ('error' in result && result.error)
                    setMessage(result.error)
                  else
                    setRequests((current) =>
                      current.filter((x) => x.id !== r.id),
                    )
                } catch {
                  setMessage('Could not confirm approval. Please try again.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Review & approve
            </button>
            <button
              disabled={busy}
              className="border p-2 rounded-lg"
              onClick={async () => {
                setBusy(true)
                try {
                  const result = await respondToSubstitution(r.id, false)
                  if (result.error) setMessage(result.error)
                  else
                    setRequests((current) =>
                      current.filter((x) => x.id !== r.id),
                    )
                } finally {
                  setBusy(false)
                }
              }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
