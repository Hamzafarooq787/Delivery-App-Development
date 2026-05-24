'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { updateCustomerLocation, clearCustomerLocation } from '@/app/actions/tracking'
import {
  fetchRoute,
  googlePlacesAutocomplete,
  googlePlaceCoords,
  googleReverseGeocode,
  googleDetectCountryCode,
  type PlaceSuggestion,
} from '@/lib/google'

const GoogleLiveMap = dynamic(
  () => import('@/components/maps/google-live-map').then((m) => m.GoogleLiveMap),
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

function getPrice(miles: number): number {
  if (miles <= 3) return 10
  if (miles <= 7) return 15
  if (miles <= 12) return 20
  return Math.round((20 + (miles - 12) * 1.5) * 100) / 100
}

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

type LatLng = { lng: number; lat: number }

function AddressInput({
  label, icon, color, placeholder, value, onChange, onSelect,
  onGpsClick, gpsLoading, proximity, countryCode,
}: {
  label: string; icon: string; color: string; placeholder: string; value: string
  onChange: (v: string) => void
  onSelect: (place: string, coords: LatLng | null) => void
  onGpsClick: () => void
  gpsLoading: boolean
  proximity: LatLng | null
  countryCode: string | null
}) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [selecting, setSelecting] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function openDropdown() {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width })
    setOpen(true)
  }

  function handleChange(v: string) {
    onChange(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.length < 2) { setSuggestions([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await googlePlacesAutocomplete(v, {
          proximity: proximity ?? undefined,
          countryCode,
        })
        setSuggestions(results)
        if (results.length > 0) openDropdown()
        else setOpen(false)
      } catch (err) {
        console.error('[autocomplete] fetch failed:', err)
        setOpen(false)
      }
    }, 250)
  }

  async function handleSelect(s: PlaceSuggestion) {
    onChange(s.text)
    setOpen(false)
    setSuggestions([])
    setSelecting(true)
    const coords = await googlePlaceCoords(s.placeId).catch(() => null)
    onSelect(s.text, coords)
    setSelecting(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center justify-between mb-2">
        <label className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${color}`}>
          <span className="material-symbols-outlined text-sm">{icon}</span>
          {label}
        </label>
        <button
          type="button"
          onClick={onGpsClick}
          disabled={gpsLoading || selecting}
          className="flex items-center gap-1 text-[10px] font-bold text-[#a3a6ff] hover:text-white transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm">
            {gpsLoading ? 'hourglass_empty' : 'my_location'}
          </span>
          {gpsLoading ? 'Locating…' : 'Use my location'}
        </button>
      </div>
      <div className="relative">
        <input
          ref={inputRef}
          className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#494847] outline-none focus:border-[#a3a6ff]/50 transition-colors"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) openDropdown() }}
          autoComplete="off"
        />
        {selecting && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#adaaaa]">Getting location…</span>
        )}
      </div>
      {open && suggestions.length > 0 && dropdownRect && (
        <div
          style={{ position: 'fixed', top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width, zIndex: 99999 }}
          className="bg-[#1a1919] border border-[#494847]/30 rounded-xl overflow-hidden shadow-2xl"
        >
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-[#262626] transition-colors border-b border-[#494847]/10 last:border-0"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s) }}
            >
              <span className="material-symbols-outlined text-[#adaaaa] text-sm mt-0.5 shrink-0">location_on</span>
              <span className="text-xs text-white leading-relaxed">{s.text}</span>
            </button>
          ))}
          <div className="flex items-center justify-end px-3 py-1.5 border-t border-[#494847]/10">
            <span className="text-[9px] text-[#494847]">powered by Google</span>
          </div>
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

  // User's device GPS + detected country
  const [userCoords, setUserCoords] = useState<LatLng | null>(null)
  const [countryCode, setCountryCode] = useState<string | null>(null)
  const [gpsPickupLoading, setGpsPickupLoading] = useState(false)
  const [gpsDestLoading, setGpsDestLoading] = useState(false)

  // Live location sharing state
  const [liveLocationActive, setLiveLocationActive] = useState(false)
  const [liveLocationError, setLiveLocationError] = useState<string | null>(null)
  const liveLocationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // On mount: silently get GPS and detect country to restrict autocomplete
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const coords: LatLng = { lng: pos.coords.longitude, lat: pos.coords.latitude }
      setUserCoords(coords)
      const code = await googleDetectCountryCode(coords.lat, coords.lng).catch(() => null)
      if (code) setCountryCode(code)
    }, () => {}, { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 })
  }, [])

  // Cleanup live location interval on unmount
  useEffect(() => {
    return () => {
      if (liveLocationIntervalRef.current) {
        clearInterval(liveLocationIntervalRef.current)
      }
    }
  }, [])

  // Calculate route when both coords set
  useEffect(() => {
    if (!pickupCoords || !deliveryCoords) { setRouteGeometry(null); setRouteInfo(null); return }
    fetchRoute(pickupCoords, deliveryCoords).then((r) => {
      if (!r) return
      setRouteGeometry(r.geometry)
      setRouteInfo({ miles: r.distance_miles, duration_min: r.duration_min })
    })
  }, [pickupCoords, deliveryCoords])

  // Fill an address field from device GPS (reverse geocode to exact street address)
  async function fillFromGps(field: 'pickup' | 'destination') {
    if (!('geolocation' in navigator)) { toast.error('GPS not supported on this device.'); return }
    if (field === 'pickup') setGpsPickupLoading(true)
    else setGpsDestLoading(true)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude: lng, latitude: lat } = pos.coords
        // Set coords immediately — stops the spinner
        if (field === 'pickup') {
          setPickupCoords({ lat, lng })
          setPickupValue(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
          setGpsPickupLoading(false)
        } else {
          setDeliveryCoords({ lat, lng })
          setDeliveryValue(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
          setGpsDestLoading(false)
        }
        // Then silently update the text to a real address
        googleReverseGeocode(lat, lng).then((place) => {
          if (!place) return
          if (field === 'pickup') setPickupValue(place)
          else setDeliveryValue(place)
        }).catch(() => {})
      },
      () => {
        if (field === 'pickup') setGpsPickupLoading(false)
        else setGpsDestLoading(false)
        toast.error('Location permission denied. Please allow location access.')
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 }
    )
  }

  // Start live location sharing — also sets destination to customer's GPS
  function startLiveLocation() {
    if (!('geolocation' in navigator)) {
      setLiveLocationError('GPS not supported on this device.')
      return
    }
    setLiveLocationError(null)

    const sendAndUpdate = (pos: GeolocationPosition) => {
      const { latitude: lat, longitude: lng } = pos.coords
      updateCustomerLocation({ lat, lng })
      // Keep destination coords in sync so the route map stays current
      setDeliveryCoords({ lat, lng })
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        // Reverse geocode to get exact street address for the destination field
        const place = await googleReverseGeocode(lat, lng).catch(() => null)
        setDeliveryValue(place || `${lat.toFixed(6)}, ${lng.toFixed(6)}`)
        setDeliveryCoords({ lat, lng })
        await updateCustomerLocation({ lat, lng })
        setLiveLocationActive(true)
        liveLocationIntervalRef.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition(sendAndUpdate, () => {})
        }, 5000)
      },
      () => {
        setLiveLocationError('Location permission denied. Please allow location access.')
      }
    )
  }

  // Stop live location sharing — clear destination so user can fill it manually
  async function stopLiveLocation() {
    if (liveLocationIntervalRef.current) {
      clearInterval(liveLocationIntervalRef.current)
      liveLocationIntervalRef.current = null
    }
    setLiveLocationActive(false)
    setDeliveryValue('')
    setDeliveryCoords(null)
    await clearCustomerLocation()
  }

  async function handleSubmit() {
    if (submitting) return
    if (!pickupValue) { toast.error('Enter a pickup address.'); return }
    if (!deliveryValue && !liveLocationActive) { toast.error('Enter a delivery address or use live location.'); return }
    if (!confirmed) { toast.error('Please confirm your item is legal and safe.'); return }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('You must be signed in.'); setSubmitting(false); return }

      const price = routeInfo ? getPrice(routeInfo.miles) : null

      // Generate a unique tracking number — TRK-<timestamp><random4>
      const tracking_number = `TRK-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

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
        price,
        tracking_number,
      })

      if (error) { toast.error(error.message || 'Failed to create delivery.'); setSubmitting(false); return }

      // Fire-and-forget: send Web Push to all subscribed drivers
      // (non-blocking — delivery flow continues even if this fails)
      fetch('/api/push/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role:  'driver',
          title: '🚚 New Job Available',
          body:  `${pickupValue} → ${deliveryValue || 'Live location'}`,
          url:   '/dashboard/driver/jobs/available',
          tag:   'new-job',
        }),
      }).catch(() => {}) // never block the UI on push errors

      // Stop live location if active when delivery is submitted
      if (liveLocationActive) await stopLiveLocation()

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

      <div className="relative z-10 w-full max-w-lg bg-[#1a1919] rounded-2xl border border-[#494847]/20 shadow-2xl flex flex-col" style={{ maxHeight: '92dvh' }}>

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
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4 overscroll-contain">

          {/* Pickup */}
          <AddressInput
            label="Pickup"
            icon="radio_button_checked"
            color="text-[#a3a6ff]"
            placeholder="Search pickup address..."
            value={pickupValue}
            onChange={(v) => { setPickupValue(v); if (!v) setPickupCoords(null) }}
            onSelect={(place, coords) => { setPickupValue(place); setPickupCoords(coords ?? null) }}
            onGpsClick={() => fillFromGps('pickup')}
            gpsLoading={gpsPickupLoading}
            proximity={userCoords}
            countryCode={countryCode}
          />

          {/* Arrow divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#494847]/20" />
            <span className="material-symbols-outlined text-[#494847] text-sm">arrow_downward</span>
            <div className="h-px flex-1 bg-[#494847]/20" />
          </div>

          {/* Destination — replaced by live location card when active */}
          {liveLocationActive ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#c180ff]">
                  <span className="material-symbols-outlined text-sm">location_on</span>
                  Destination
                </label>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0 flex items-center justify-center w-8 h-8">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-cyan-400/30 animate-ping" />
                    <span className="material-symbols-outlined text-cyan-400 text-lg relative z-10">my_location</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-cyan-400">Your live location</p>
                    <p className="text-[10px] text-[#adaaaa] truncate">{deliveryValue || 'Getting your location…'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={stopLiveLocation}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-colors"
                >
                  Stop
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <AddressInput
                label="Destination"
                icon="location_on"
                color="text-[#c180ff]"
                placeholder="Search delivery address..."
                value={deliveryValue}
                onChange={(v) => { setDeliveryValue(v); if (!v) setDeliveryCoords(null) }}
                onSelect={(place, coords) => { setDeliveryValue(place); setDeliveryCoords(coords ?? null) }}
                onGpsClick={() => fillFromGps('destination')}
                gpsLoading={gpsDestLoading}
                proximity={userCoords}
                countryCode={countryCode}
              />
              {/* Live location as alternative to typing destination */}
              <button
                type="button"
                onClick={startLiveLocation}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-dashed border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/5 transition-all"
              >
                <span className="material-symbols-outlined text-base">share_location</span>
                <span className="text-xs font-bold">Use my live location as destination</span>
              </button>
              {liveLocationError && (
                <p className="text-[10px] text-red-400 px-1">{liveLocationError}</p>
              )}
            </div>
          )}

          {/* Route map preview */}
          {showMap && (
            <div className="rounded-xl overflow-hidden border border-[#494847]/20">
              <GoogleLiveMap
                pickup={pickupCoords}
                destination={deliveryCoords}
                routeGeometry={routeGeometry}
                height={200}
              />
              {routeInfo && (() => {
                const price = getPrice(routeInfo.miles)
                const isPerMile = routeInfo.miles > 12
                return (
                  <>
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
                      <div className="w-px h-8 bg-[#494847]/30" />
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#6ee7b7] text-base">payments</span>
                        <div>
                          <p className="text-xs font-black text-[#6ee7b7]">£{price}</p>
                          <p className="text-[9px] text-[#adaaaa] uppercase tracking-wider">Price</p>
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3 bg-[#6ee7b7]/5 border-t border-[#6ee7b7]/20 flex items-center justify-between">
                      <p className="text-[11px] text-[#adaaaa]">
                        {isPerMile
                          ? <>£20 + <span className="text-white font-bold">{(routeInfo.miles - 12).toFixed(1)} miles</span> × £1.50</>
                          : <>Delivery charge for <span className="text-white font-bold">{routeInfo.miles} miles</span></>
                        }
                      </p>
                      <p className="text-lg font-black text-[#6ee7b7]">£{price}</p>
                    </div>
                  </>
                )
              })()}
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
            {submitting ? 'Requesting…' : routeInfo ? `Request Delivery — £${getPrice(routeInfo.miles)}` : 'Request Delivery'}
          </button>
        </div>
      </div>
    </div>
  )
}
