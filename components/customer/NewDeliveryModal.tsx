'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast, Toaster } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface NewDeliveryModalProps {
  onClose: () => void
}

const PAYLOAD_OPTIONS = [
  { icon: 'package_2', label: 'Standard Box' },
  { icon: 'pallet', label: 'Heavy Pallet' },
  { icon: 'precision_manufacturing', label: 'Fragile' },
] as const

export default function NewDeliveryModal({ onClose }: NewDeliveryModalProps) {
  const router = useRouter()

  const [pickupStreet, setPickupStreet] = useState('')
  const [pickupCity, setPickupCity] = useState('')
  const [deliveryStreet, setDeliveryStreet] = useState('')
  const [deliveryCity, setDeliveryCity] = useState('')
  const [selectedPayload, setSelectedPayload] = useState<string>(PAYLOAD_OPTIONS[0].label)
  const [submitting, setSubmitting] = useState(false)

  const buildAddress = (street: string, city: string) =>
    [street, city].map((p) => p.trim()).filter(Boolean).join(', ')

  async function handleSubmit() {
    if (submitting) return
    const pickup_address = buildAddress(pickupStreet, pickupCity)
    const delivery_address = buildAddress(deliveryStreet, deliveryCity)
    if (!pickup_address) { toast.error('Enter a pickup address.'); return }
    if (!delivery_address) { toast.error('Enter a delivery address.'); return }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('You must be signed in.'); setSubmitting(false); return }

      const { error } = await supabase.from('delivery_requests').insert({
        customer_id: user.id,
        pickup_address,
        delivery_address,
        item_description: selectedPayload,
        status: 'requested',
      })

      if (error) { toast.error(error.message || 'Failed to create delivery.'); setSubmitting(false); return }

      toast.success('Delivery requested!')
      setTimeout(() => {
        router.push('/dashboard/customer/active-deliveries')
        router.refresh()
      }, 600)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unexpected error.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <Toaster position="top-center" richColors />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md bg-[#1a1919] rounded-2xl border border-[#494847]/20 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#494847]/15">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#a3a6ff]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#a3a6ff] text-lg">local_shipping</span>
            </div>
            <div>
              <p className="text-sm font-bold text-white">New Delivery</p>
              <p className="text-[10px] text-[#adaaaa] uppercase tracking-wider">Request a courier</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">

          {/* Pickup */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-[#a3a6ff] uppercase tracking-wider mb-2">
              <span className="material-symbols-outlined text-sm">radio_button_checked</span>
              Pickup
            </label>
            <input
              className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#494847] outline-none focus:border-[#a3a6ff]/50 transition-colors mb-2"
              placeholder="Street address"
              value={pickupStreet}
              onChange={(e) => setPickupStreet(e.target.value)}
            />
            <input
              className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#494847] outline-none focus:border-[#a3a6ff]/50 transition-colors"
              placeholder="City"
              value={pickupCity}
              onChange={(e) => setPickupCity(e.target.value)}
            />
          </div>

          {/* Arrow divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#494847]/20" />
            <span className="material-symbols-outlined text-[#494847] text-sm">arrow_downward</span>
            <div className="h-px flex-1 bg-[#494847]/20" />
          </div>

          {/* Delivery */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-[#c180ff] uppercase tracking-wider mb-2">
              <span className="material-symbols-outlined text-sm">location_on</span>
              Destination
            </label>
            <input
              className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#494847] outline-none focus:border-[#c180ff]/50 transition-colors mb-2"
              placeholder="Street address"
              value={deliveryStreet}
              onChange={(e) => setDeliveryStreet(e.target.value)}
            />
            <input
              className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#494847] outline-none focus:border-[#c180ff]/50 transition-colors"
              placeholder="City"
              value={deliveryCity}
              onChange={(e) => setDeliveryCity(e.target.value)}
            />
          </div>

          {/* Package type */}
          <div>
            <p className="text-[10px] font-bold text-[#adaaaa] uppercase tracking-wider mb-2">Package Type</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYLOAD_OPTIONS.map((item) => {
                const active = selectedPayload === item.label
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setSelectedPayload(item.label)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-bold transition-all ${
                      active
                        ? 'bg-[#a3a6ff]/10 border-[#a3a6ff]/40 text-[#a3a6ff]'
                        : 'bg-[#262626] border-[#494847]/20 text-[#adaaaa] hover:border-[#494847]/40'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{item.icon}</span>
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#494847]/15 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-[#a3a6ff] text-[#0f00a4] font-bold text-sm hover:bg-[#8387ff] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ boxShadow: '0 0 20px rgba(163,166,255,0.25)' }}
          >
            <span className="material-symbols-outlined text-base">bolt</span>
            {submitting ? 'Requesting…' : 'Request Delivery'}
          </button>
        </div>
      </div>
    </div>
  )
}
