'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface NewDeliveryModalProps {
  onClose: () => void
}

const PAYLOAD_OPTIONS = [
  { icon: 'package_2', label: 'Standard Box' },
  { icon: 'pallet', label: 'Heavy Pallet' },
  { icon: 'precision_manufacturing', label: 'Fragile' },
] as const

const PROHIBITED_ITEMS = [
  { icon: 'gavel', label: 'Illegal goods' },
  { icon: 'security', label: 'Weapons & ammo' },
  { icon: 'payments', label: 'Cash & currency' },
  { icon: 'whatshot', label: 'Flammables' },
  { icon: 'science', label: 'Hazardous chemicals' },
  { icon: 'medication', label: 'Controlled substances' },
  { icon: 'no_adult_content', label: 'Prohibited content' },
  { icon: 'battery_alert', label: 'Damaged batteries' },
]

export default function NewDeliveryModal({ onClose }: NewDeliveryModalProps) {
  const router = useRouter()

  const [pickupStreet, setPickupStreet] = useState('')
  const [pickupCity, setPickupCity] = useState('')
  const [deliveryStreet, setDeliveryStreet] = useState('')
  const [deliveryCity, setDeliveryCity] = useState('')
  const [selectedPayload, setSelectedPayload] = useState<string>(PAYLOAD_OPTIONS[0].label)
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const buildAddress = (street: string, city: string) =>
    [street, city].map((p) => p.trim()).filter(Boolean).join(', ')

  async function handleSubmit() {
    if (submitting) return
    const pickup_address = buildAddress(pickupStreet, pickupCity)
    const delivery_address = buildAddress(deliveryStreet, deliveryCity)
    if (!pickup_address) { toast.error('Enter a pickup address.'); return }
    if (!delivery_address) { toast.error('Enter a delivery address.'); return }
    if (!confirmed) { toast.error('Please confirm your item is legal and safe.'); return }

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
      onClose()
      router.push('/dashboard/customer/active-deliveries')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unexpected error.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md bg-[#1a1919] rounded-2xl border border-[#494847]/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#494847]/15 shrink-0">
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

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">

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

          {/* Prohibited Items */}
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-red-500/15">
              <span className="material-symbols-outlined text-red-400 text-base">block</span>
              <p className="text-[11px] font-bold text-red-400 uppercase tracking-wider">Prohibited Items</p>
            </div>
            <div className="px-4 py-3 grid grid-cols-2 gap-2">
              {PROHIBITED_ITEMS.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-400/70 text-sm">{item.icon}</span>
                  <span className="text-[11px] text-[#adaaaa]">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="px-4 pb-3">
              <p className="text-[10px] text-[#494847] leading-relaxed">
                Shipping prohibited items may result in immediate cancellation, account suspension, and legal action.
              </p>
            </div>
          </div>

          {/* Confirmation checkbox */}
          <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
            confirmed
              ? 'border-green-500/40 bg-green-500/5'
              : 'border-[#494847]/20 bg-[#262626] hover:border-[#494847]/40'
          }`}>
            <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${
              confirmed ? 'bg-green-500 border-green-500' : 'border-[#494847]/60'
            }`}>
              {confirmed && (
                <span className="material-symbols-outlined text-white text-[12px]">check</span>
              )}
            </div>
            <input
              type="checkbox"
              className="sr-only"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <p className="text-[11px] text-[#adaaaa] leading-relaxed">
              I confirm that my package does <span className="text-white font-bold">not</span> contain any prohibited, illegal, or dangerous items. I accept full responsibility for the contents.
            </p>
          </label>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#494847]/15 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !confirmed}
            className="flex-1 py-2.5 rounded-xl bg-[#a3a6ff] text-[#0f00a4] font-bold text-sm hover:bg-[#8387ff] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ boxShadow: confirmed ? '0 0 20px rgba(163,166,255,0.25)' : 'none' }}
          >
            <span className="material-symbols-outlined text-base">bolt</span>
            {submitting ? 'Requesting…' : 'Request Delivery'}
          </button>
        </div>
      </div>
    </div>
  )
}
