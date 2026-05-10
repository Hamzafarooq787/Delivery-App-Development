'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { MAPBOX_TOKEN } from '@/lib/mapbox'
import { fetchRoute } from '@/lib/mapbox'
import dynamic from 'next/dynamic'

const MapboxLiveMap = dynamic(
  () => import('@/components/maps/mapbox-live-map').then((m) => m.MapboxLiveMap),
  { ssr: false }
)

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

type Suggestion = { place_name: string; center: [number, number] }

type LatLng = { lng: number; lat: number }

function AddressInput({
  label,
  icon,
  color,
  placeholder,
  value,
  onChange,
  onSelect,
}: {
  label: string
  icon: string
  color: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  onSelect: (place: string, coords: LatLng) => void
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function handleChange(v: string) {
    onChange(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.length < 3) { setSuggestions([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(v)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5&types=address,place,locality,neighborhood,poi`
        )
        const data = await res.json()
        const features = (data.features || []) as Suggestion[]
        setSuggestions(features)
        setOpen(features.length > 0)
      } catch {}
    }, 300)
  }

  return (
    <div ref={ref} className="relative">
      <label className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-2 ${color}`}>
        <span className="material-symbols-outlined text-sm">{icon}</span>
        {label}
      </label>
      <input
        className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#494847] outline-none focus:border-[#a3a6ff]/50 transition-colors"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-[100] left-0 right-0 mt-1 bg-[#1a1919] border border-[#494847]/30 rounded-xl overflow-hidden shadow-2xl">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-[#262626] transition-colors border-b border-[#494847]/10 last:border-0"
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(s.place_name, { lng: s.center[0], lat: s.center[1] })
                onChange(s.place_name)
                setOpen(false)
                setSuggestions([])
              }}
            >
              <span className="material-symbols-outlined text-[#adaaaa] text-sm mt-0.5 shrink-0">location_on</span>
              <span className="text-xs text-white leading-relaxed">{s.place_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NewDeliveryModal({ onClose }: NewDeliveryModalProps) {
  const router = useRouter()

  const [pickupValue, setPickupValue] = useState('')
  const [deliveryValue, setDeliveryValue] = useState('')
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null)
  const [deliveryCoords, setDeliveryCoords] = useState<LatLng | null>(null)
  const [routeGeometry, setRouteGeometry] = useState<GeoJSON.LineString | null>(null)
  const [routeInfo, setRouteInfo] = useState<{ miles: number; duration_min: number } | null>(null)
  const [selectedPayload, setSelectedPayload] = useState<string>(PAYLOAD_OPTIONS[0].label)
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Calculate route when both coords are set
  useEffect(() => {
    if (!pickupCoords || !deliveryCoords) { setRouteGeometry(null); setRouteInfo(null); return }
    fetchRoute(pickupCoords, deliveryCoords).then((r) => {
      if (!r) return
      setRouteGeometry(r.geometry)
      setRouteInfo({ miles: r.distance_miles, duration_min: r.duration_min })
    })
  }, [pickupCoords, deliveryCoords])

  async function handleSubmit() {
    if (submitting) return
    if (!pickupValue) { toast.error('Enter a pickup address.'); return }
    if (!deliveryValue) { toast.error('Enter a delivery address.'); return }
    if (!confirmed) { toast.error('Please confirm your item is legal and safe.'); return }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('You must be signed in.'); setSubmitting(false); return }

      const { error } = await supabase.from('delivery_requests').insert({
        customer_id: user.id,
        pickup_address: pickupValue,
        delivery_address: deliveryValue,
        pickup_lat: pickupCoords?.lat ?? null,
        pickup_lng: pickupCoords?.lng ?? null,
        delivery_lat: deliveryCoords?.lat ?? null,
        delivery_lng: deliveryCoords?.lng ?? null,
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

  const showMap = !!(pickupCoords || deliveryCoords)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-[#1a1919] rounded-2xl border border-[#494847]/20 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

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
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">

          {/* Pickup */}
          <AddressInput
            label="Pickup"
            icon="radio_button_checked"
            color="text-[#a3a6ff]"
            placeholder="Search pickup address..."
            value={pickupValue}
            onChange={(v) => { setPickupValue(v); if (!v) setPickupCoords(null) }}
            onSelect={(place, coords) => { setPickupValue(place); setPickupCoords(coords) }}
          />

          {/* Arrow divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#494847]/20" />
            <span className="material-symbols-outlined text-[#494847] text-sm">arrow_downward</span>
            <div className="h-px flex-1 bg-[#494847]/20" />
          </div>

          {/* Destination */}
          <AddressInput
            label="Destination"
            icon="location_on"
            color="text-[#c180ff]"
            placeholder="Search delivery address..."
            value={deliveryValue}
            onChange={(v) => { setDeliveryValue(v); if (!v) setDeliveryCoords(null) }}
            onSelect={(place, coords) => { setDeliveryValue(place); setDeliveryCoords(coords) }}
          />

          {/* Route map preview */}
          {showMap && (
            <div className="rounded-xl overflow-hidden border border-[#494847]/20">
              <MapboxLiveMap
                pickup={pickupCoords}
                destination={deliveryCoords}
                routeGeometry={routeGeometry}
                height={200}
              />
              {routeInfo && (
                <div className="flex items-center justify-around px-4 py-3 bg-[#262626] border-t border-[#494847]/20">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#a3a6ff] text-base">straighten</span>
                    <div>
                      <p className="text-xs font-black text-white">{routeInfo.miles} mi</p>
                      <p className="text-[9px] text-[#adaaaa] uppercase tracking-wider">Distance</p>
                    </div>
                  </div>
                  <div className="w-px h-8 bg-[#494847]/30" />
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#c180ff] text-base">schedule</span>
                    <div>
                      <p className="text-xs font-black text-white">{routeInfo.duration_min} min</p>
                      <p className="text-[9px] text-[#adaaaa] uppercase tracking-wider">Est. Drive</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
            confirmed ? 'border-green-500/40 bg-green-500/5' : 'border-[#494847]/20 bg-[#262626] hover:border-[#494847]/40'
          }`}>
            <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${
              confirmed ? 'bg-green-500 border-green-500' : 'border-[#494847]/60'
            }`}>
              {confirmed && <span className="material-symbols-outlined text-white text-[12px]">check</span>}
            </div>
            <input type="checkbox" className="sr-only" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <p className="text-[11px] text-[#adaaaa] leading-relaxed">
              I confirm that my package does <span className="text-white font-bold">not</span> contain any prohibited, illegal, or dangerous items. I accept full responsibility for the contents.
            </p>
          </label>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#494847]/15 flex items-center justify-between gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors">
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
