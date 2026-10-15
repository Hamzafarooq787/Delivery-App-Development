'use client'
import { useState } from 'react'
import {
  processWeeklyLaunchPayouts,
  recordShoppingFunding,
} from '@/app/actions/launch-operations'
export function LaunchOperationsPanel() {
  const [order, setOrder] = useState(''),
    [reference, setReference] = useState(''),
    [message, setMessage] = useState('')
  return (
    <section className="p-4 rounded-xl border border-gray-400 space-y-3">
      <button
        className="rounded-lg bg-[var(--color-primary)] text-black p-3 font-bold"
        onClick={async () => {
          const r = await processWeeklyLaunchPayouts()
          setMessage(
            'error' in r
              ? (r.error ?? 'Failed')
              : `${r.paid} transfers sent, ${r.blocked} blocked`,
          )
        }}
      >
        Prepare and send weekly payouts
      </button>
      <p className="text-sm">
        Use only a verified GoDrop-funded card. This reference does not itself
        move shopping funds.
      </p>
      <input
        aria-label="Shopping order ID"
        placeholder="Shopping order ID"
        value={order}
        onChange={(e) => setOrder(e.target.value)}
        className="bg-[#333] border p-2 rounded-lg"
      />
      <input
        aria-label="Funded purchase card reference"
        placeholder="Verified purchase-card reference"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        className="bg-[#333] border p-2 rounded-lg"
      />
      <button
        className="border rounded-lg p-2"
        onClick={async () => {
          const r = await recordShoppingFunding(order, reference)
          setMessage(r.error ?? 'Funding reference recorded')
        }}
      >
        Record verified funding
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
