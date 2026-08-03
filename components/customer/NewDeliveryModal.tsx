'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateCustomerLocation, clearCustomerLocation } from '@/app/actions/tracking'
import { createDeliveryRequest } from '@/app/actions/delivery'
import { createWalletTopUpSession } from '@/app/actions/payments'
import { getWalletBalance } from '@/app/actions/wallet'
import { PACKAGE_SIZES, PACKAGE_SIZE_INFO, type PackageSize } from '@/lib/vehicles'
import {
  fetchRoute,
  googlePlacesAutocomplete,
  googlePlaceCoords,
  googleReverseGeocode,
  googleDetectCountryCode,
  type PlaceSuggestion,
} from '@/lib/google'
import { saveDeliveryDraft, type DeliveryDraft } from '@/lib/delivery-draft'

const GoogleLiveMap = dynamic(
  () => import('@/components/maps/google-live-map').then((m) => m.GoogleLiveMap),
  { ssr: false }
)

interface NewDeliveryModalProps {
  onClose: () => void
  /** Pre-fills the form — used when resuming after a wallet top-up. */
  initialDraft?: DeliveryDraft | null
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

// £10 stays "£10", £21.5 becomes "£21.50"
function formatPrice(price: number): string {
  return Number.isInteger(price) ? String(price) : price.toFixed(2)
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

export default function NewDeliveryModal({ onClose, initialDraft }: NewDeliveryModalProps) {
  const router = useRouter()

  const [pickupValue, setPickupValue] = useState(initialDraft?.pickupValue ?? '')
  const [deliveryValue, setDeliveryValue] = useState(initialDraft?.deliveryValue ?? '')
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(initialDraft?.pickupCoords ?? null)
  const [deliveryCoords, setDeliveryCoords] = useState<LatLng | null>(initialDraft?.deliveryCoords ?? null)
  const [routeGeometry, setRouteGeometry] = useState<GeoJSON.LineString | null>(null)
  const [routeInfo, setRouteInfo] = useState<{ miles: number; km: number; duration_min: number } | null>(null)
  const [selectedPayload, setSelectedPayload] = useState<string>(initialDraft?.selectedPayload ?? PAYLOAD_OPTIONS[0].label)
  const [packageSize, setPackageSize] = useState<PackageSize | null>(initialDraft?.packageSize ?? null)
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Wallet balance — must cover the delivery price before an order can be
  // placed. This is a UX gate only; the server re-checks and deducts
  // atomically, so a stale/bypassed client value can't create a free order.
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [addingFunds, setAddingFunds] = useState(false)

  useEffect(() => {
    getWalletBalance().then((res) => setWalletBalance(res.balance)).catch(() => setWalletBalance(null))
  }, [])

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
      setRouteInfo({ miles: r.distance_miles, km: r.distance_km, duration_min: r.duration_min })
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

  const price = routeInfo ? getPrice(routeInfo.miles) : null
  const insufficientFunds = price !== null && walletBalance !== null && walletBalance < price

  async function handleSubmit() {
    if (submitting) return
    if (!pickupValue) { toast.error('Enter a pickup address.'); return }
    if (!deliveryValue && !liveLocationActive) { toast.error('Enter a delivery address or use live location.'); return }
    if (!packageSize) { toast.error('Select a package size.'); return }
    if (!confirmed) { toast.error('Please confirm your item is legal and safe.'); return }
    if (insufficientFunds) { handleAddFunds(); return }

    setSubmitting(true)
    try {
      const result = await createDeliveryRequest({
        pickup_address: pickupValue,
        delivery_address: deliveryValue,
        pickup_lat: pickupCoords?.lat ?? null,
        pickup_lng: pickupCoords?.lng ?? null,
        delivery_lat: deliveryCoords?.lat ?? null,
        delivery_lng: deliveryCoords?.lng ?? null,
        item_description: selectedPayload,
        package_size: packageSize,
        price,
      })

      if ('error' in result) {
        if (result.code === 'insufficient_funds') {
          // Balance changed since we last checked (e.g. another tab spent it) — refresh and re-gate.
          const fresh = await getWalletBalance()
          setWalletBalance(fresh.balance)
          toast.error(result.error)
        } else {
          toast.error(result.error)
        }
        setSubmitting(false)
        return
      }

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

  // Save the in-progress form, then send the customer to Stripe to top up
  // exactly enough to cover this delivery. They land back with the modal
  // reopened and pre-filled (see the dashboard layout's resume handling).
  async function handleAddFunds() {
    if (addingFunds || price === null) return
    setAddingFunds(true)
    try {
      const needed = Math.max(1, Math.ceil((price - (walletBalance ?? 0)) * 100) / 100)
      saveDeliveryDraft({
        pickupValue,
        deliveryValue,
        pickupCoords,
        deliveryCoords,
        selectedPayload,
        packageSize,
      })
      const result = await createWalletTopUpSession(Math.min(500, needed), 'new-delivery')
      if ('url' in result) {
        window.location.href = result.url
      } else {
        toast.error(result.error)
        setAddingFunds(false)
      }
    } catch {
      toast.error('Could not start the payment. Please try again.')
      setAddingFunds(false)
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
              {routeInfo && price !== null && (() => {
                const isPerMile = routeInfo.miles > 12
                return (
                  <>
                    <div className="flex items-center justify-around px-4 py-3 bg-[#262626] border-t border-[#494847]/20">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#a3a6ff] text-base">straighten</span>
                        <div>
                          <p className="text-xs font-black text-white">{routeInfo.miles} mi <span className="text-[#adaaaa] font-semibold">({routeInfo.km} km)</span></p>
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
                          <p className="text-xs font-black text-[#6ee7b7]">£{formatPrice(price)}</p>
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
                      <p className="text-lg font-black text-[#6ee7b7]">£{formatPrice(price)}</p>
                    </div>
                    {walletBalance !== null && (
                      <div className="px-4 py-2 bg-[#1a1919] border-t border-[#494847]/10 flex items-center justify-between">
                        <p className="text-[10px] text-[#adaaaa] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[13px]">account_balance_wallet</span>
                          Wallet balance
                        </p>
                        <p className={`text-[11px] font-bold ${insufficientFunds ? 'text-[#fb923c]' : 'text-[#adaaaa]'}`}>
                          £{walletBalance.toFixed(2)}
                        </p>
                      </div>
                    )}
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

          {/* Package size — determines which drivers (by vehicle) get matched */}
          <div>
            <p className="text-[10px] font-bold text-[#adaaaa] uppercase tracking-wider mb-2">Package Size</p>
            <div className="grid grid-cols-2 gap-2">
              {PACKAGE_SIZES.map((size) => {
                const active = packageSize === size
                const info = PACKAGE_SIZE_INFO[size]
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPackageSize(size)}
                    className={`flex flex-col items-start gap-0.5 py-2.5 px-3 rounded-xl border text-left transition-all ${
                      active
                        ? 'bg-[#a3a6ff]/10 border-[#a3a6ff]/40'
                        : 'bg-[#262626] border-[#494847]/20 hover:border-[#494847]/40'
                    }`}
                  >
                    <span className={`text-xs font-bold ${active ? 'text-[#a3a6ff]' : 'text-white'}`}>{info.label}</span>
                    <span className="text-[10px] text-[#adaaaa] leading-snug">{info.description}</span>
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

          {/* Insufficient wallet balance */}
          {insufficientFunds && price !== null && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-[#fb923c]/30 bg-[#fb923c]/5">
              <span className="material-symbols-outlined text-[#fb923c] text-lg mt-0.5 shrink-0">account_balance_wallet</span>
              <div>
                <p className="text-xs font-bold text-[#fb923c]">Insufficient wallet balance</p>
                <p className="text-[11px] text-[#adaaaa] mt-0.5 leading-relaxed">
                  This delivery costs £{formatPrice(price)} — your wallet has £{(walletBalance ?? 0).toFixed(2)}.
                  Add funds to continue; you'll return here to finish this request.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#494847]/15 flex items-center justify-between gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors">
            Cancel
          </button>
          {insufficientFunds ? (
            <button
              onClick={handleAddFunds}
              disabled={addingFunds}
              className="flex-1 py-2.5 rounded-xl bg-[#6ee7b7] text-[#052e16] font-bold text-sm hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              {addingFunds ? 'Redirecting…' : `Add Funds — £${formatPrice(Math.max(1, Math.ceil(((price ?? 0) - (walletBalance ?? 0)) * 100) / 100))} needed`}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !confirmed || !packageSize}
              className="flex-1 py-2.5 rounded-xl bg-[#a3a6ff] text-[#0f00a4] font-bold text-sm hover:bg-[#8387ff] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ boxShadow: confirmed ? '0 0 20px rgba(163,166,255,0.25)' : 'none' }}
            >
              <span className="material-symbols-outlined text-base">bolt</span>
              {submitting ? 'Requesting…' : price !== null ? `Request Delivery — £${formatPrice(price)}` : 'Request Delivery'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
