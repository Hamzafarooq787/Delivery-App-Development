'use client'
import { FeeAgreement } from './fee-agreement'
import { useState } from 'react'
import { startDriverPaymentOnboarding } from '@/app/actions/driver-payment-account'
export function PaymentAccountButton() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [agreed, setAgreed] = useState(false)
  return (
    <div className="rounded-xl border border-gray-500 bg-[#242424] p-4 text-white">
      <FeeAgreement />
      <label className="flex gap-2 my-3 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        I have read and agree to this driver fee arrangement.
      </label>
      <p className="text-sm mb-3">
        Launch earnings are paid weekly. Finish your Stripe payment account
        setup. Your statements show the agreed service-fee split and actual
        earnings; shopping purchase funds are excluded.
      </p>
      <button
        disabled={busy || !agreed}
        className="rounded-lg bg-[var(--color-primary)] text-black px-4 py-3 font-bold"
        onClick={async () => {
          setBusy(true)
          try {
            const r = await startDriverPaymentOnboarding(agreed)
            if ('error' in r) {
              setError(r.error ?? 'Payment setup failed')
              setBusy(false)
            } else window.location.assign(r.url)
          } catch {
            setError('Could not start payment setup.')
            setBusy(false)
          }
        }}
      >
        {busy ? 'Opening…' : 'Set up weekly payments'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-orange-200">
          {error}
        </p>
      )}
    </div>
  )
}
