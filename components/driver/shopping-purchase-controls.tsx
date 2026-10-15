'use client'
import { useEffect, useState } from 'react'
import { getShoppingItems, type ShoppingItemRow } from '@/app/actions/shopping'
import {
  recordShoppingUnitPrice,
  reportShoppingProblem,
} from '@/app/actions/launch-operations'
export function ShoppingPurchaseControls({
  deliveryId,
}: {
  deliveryId: string
}) {
  const [items, setItems] = useState<ShoppingItemRow[]>([]),
    [prices, setPrices] = useState<Record<string, string>>({}),
    [message, setMessage] = useState(''),
    [problem, setProblem] = useState('')
  useEffect(() => {
    getShoppingItems(deliveryId)
      .then((r) => setItems(r.data ?? []))
      .catch(() => setMessage('Could not load shopping items'))
  }, [deliveryId])
  return (
    <section className="rounded-xl border border-orange-300 bg-[#242424] p-4 text-white space-y-4">
      <h3 className="font-bold">Purchase checks</h3>
      <p className="text-sm">
        Use only the GoDrop-funded purchase card. Enter shelf prices before
        buying. Wait for customer approval for substitutions or higher prices.
        Do not pay with your own money.
      </p>
      {items.map((i) => (
        <div key={i.id} className="flex flex-wrap gap-2 items-center">
          <label className="flex-1 text-sm">
            {i.name} · price per unit (£)
            <input
              type="number"
              min="0"
              step="0.01"
              className="block w-full bg-[#333] border border-gray-400 p-2 rounded-lg"
              value={prices[i.id] ?? ''}
              onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value })}
            />
          </label>
          <button
            className="rounded-lg border border-orange-300 p-2"
            onClick={async () => {
              if (prices[i.id] === undefined || prices[i.id] === '') {
                setMessage('Enter the unit price')
                return
              }
              const r = await recordShoppingUnitPrice(
                i.id,
                Number(prices[i.id]),
              )
              setMessage(
                ('error' in r ? r.error : undefined) ??
                  ('data' in r
                    ? 'Price approval requested. Wait for the customer.'
                    : 'Shelf price recorded.'),
              )
            }}
          >
            Check price
          </button>
        </div>
      ))}
      <label className="block text-sm">
        Busy shop, unavailable products or other problem
        <textarea
          className="block w-full bg-[#333] border border-gray-400 rounded-lg p-2"
          maxLength={1000}
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
        />
      </label>
      <button
        className="rounded-lg border border-gray-400 p-2"
        onClick={async () => {
          const r = await reportShoppingProblem(deliveryId, problem)
          setMessage(r.error ?? 'Problem sent to support.')
        }}
      >
        Report problem
      </button>
      {message && (
        <p role="status" className="text-sm text-orange-200">
          {message}
        </p>
      )}
    </section>
  )
}
