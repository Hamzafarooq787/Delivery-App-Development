'use client'

import styles from './DeliverySteps.module.css'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateCustomerLocation, clearCustomerLocation } from '@/app/actions/tracking'
import { startBookingCheckout } from '@/app/actions/booking-checkout'
import { getDeliveryQuote, type DeliveryQuote } from '@/app/actions/pricing'
import { createClient } from '@/lib/supabase/client'
import { PACKAGE_SIZES, PACKAGE_SIZE_INFO, type PackageSize } from '@/lib/vehicles'
import { formatPrice } from '@/lib/pricing'
import {
  googlePlacesAutocomplete,
  googlePlaceCoords,
  googleReverseGeocode,
  googleDetectCountryCode,
  type PlaceSuggestion,
} from '@/lib/google'
import { type DeliveryDraft } from '@/lib/delivery-draft'

interface NewDeliveryModalProps {
  onClose: () => void
  /** Pre-fills the form — used when resuming after a wallet top-up. */
  initialDraft?: DeliveryDraft | null
  focusAddress?: 'pickup' | 'delivery'
}

const MAX_ITEM_PHOTOS = 5
const MAX_PHOTO_SIZE_MB = 10

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
    if (coords) inputRef.current?.blur()
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
          className="flex items-center gap-1 text-[10px] font-bold text-[var(--color-primary)] hover:text-white transition-colors disabled:opacity-50"
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
          data-delivery-address
          aria-label={label + " address"}
          className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#494847] outline-none focus:border-[var(--color-primary)]/50 transition-colors"
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
          style={{ position: 'fixed', top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width, maxHeight: Math.max(60, (window.visualViewport?.height ?? window.innerHeight) - dropdownRect.top - 76), overflowY: 'auto', zIndex: 99999 }}
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

export default function NewDeliveryModal({ onClose, initialDraft, focusAddress }: NewDeliveryModalProps) {
  const checkoutLock=useRef(false)
  const [step, setStep] = useState(1)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    frameRef.current?.querySelector<HTMLElement>('[aria-label="Close booking"]')?.focus()
    return () => previous?.focus()
  }, [])
  const [stepError, setStepError] = useState<string | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const viewport = window.visualViewport
    const measure = () => {
      if (viewport && viewport.scale !== 1) return
      const height = Math.floor(Math.min(window.innerHeight, viewport?.height ?? window.innerHeight))
      if (frameRef.current) {
        frameRef.current.style.setProperty('--booking-height', `${height}px`)
        frameRef.current.style.top = `${viewport?.offsetTop ?? 0}px`
        frameRef.current.dataset.compact = String(height < 620)
      }
    }
    measure()
    viewport?.addEventListener('resize', measure)
    viewport?.addEventListener('scroll', measure)
    window.addEventListener('resize', measure)
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      viewport?.removeEventListener('resize', measure)
      viewport?.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      document.body.style.overflow = oldOverflow
    }
  }, [])
  function goTo(next: number) {
    setStepError(null)
    setStep(next)
  }
  function continueStep() {
    if (step === 1 && !packageSize) { setStepError('Choose a package size to continue.'); return }
    if (step === 1 && uploadingPhotos) { setStepError('Please wait for your photos to finish uploading.'); return }
    if (step === 2 && (!pickupValue || !pickupCoords)) { setStepError('Choose a pickup address from the suggestions.'); return }
    if (step === 2 && (!deliveryValue || !deliveryCoords)) { setStepError('Choose a delivery address or use your live location.'); return }
    goTo(step + 1)
  }
  useEffect(() => {
    if (!focusAddress || step !== 2) return
    const timer = setTimeout(() => {
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-delivery-address]'))
      inputs[focusAddress === 'delivery' ? 1 : 0]?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [focusAddress, step])

  const [pickupValue, setPickupValue] = useState(initialDraft?.pickupValue ?? '')
  const [deliveryValue, setDeliveryValue] = useState(initialDraft?.deliveryValue ?? '')
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(initialDraft?.pickupCoords ?? null)
  const [deliveryCoords, setDeliveryCoords] = useState<LatLng | null>(initialDraft?.deliveryCoords ?? null)
  const [itemDescription, setItemDescription] = useState<string>(initialDraft?.itemDescription ?? '')
  const [itemPhotos, setItemPhotos] = useState<string[]>(initialDraft?.itemPhotos ?? [])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [packageSize, setPackageSize] = useState<PackageSize | null>(initialDraft?.packageSize ?? null)
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Authoritative price quote — computed server-side from distance, live
  // surge factors, and any discount. This is what actually gets charged;
  // nothing about price is trusted from the client at submission time.
  const [quote, setQuote] = useState<DeliveryQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState(initialDraft?.promoCode ?? '')
  const [showPromoInput, setShowPromoInput] = useState(false)

  useEffect(() => {
    if (!pickupCoords || !deliveryCoords || !packageSize) {
      setQuote(null)
      setQuoteError(null)
      return
    }
    setQuoteLoading(true)
    setQuoteError(null)
    const timer = setTimeout(async () => {
      const result = await getDeliveryQuote({
        pickupLat: pickupCoords.lat,
        pickupLng: pickupCoords.lng,
        deliveryLat: deliveryCoords.lat,
        deliveryLng: deliveryCoords.lng,
        packageSize,
        promoCode: promoCode.trim() || null,
      })
      if ('data' in result) {
        setQuote(result.data)
        setQuoteError(null)
      } else {
        setQuote(null)
        setQuoteError(result.error)
      }
      setQuoteLoading(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [pickupCoords, deliveryCoords, packageSize, promoCode])

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

  // Upload selected item photos directly to Supabase Storage — the delivery
  // doesn't exist yet at this point, so photos live under the customer's own
  // folder and their public URLs are attached to the delivery on submit.
  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    const remaining = MAX_ITEM_PHOTOS - itemPhotos.length
    if (remaining <= 0) {
      setPhotoError(`You can attach up to ${MAX_ITEM_PHOTOS} photos.`)
      return
    }

    setPhotoError(null)
    const toUpload = files.slice(0, remaining)
    if (files.length > remaining) {
      setPhotoError(`Only ${remaining} more photo${remaining === 1 ? '' : 's'} can be added (max ${MAX_ITEM_PHOTOS}).`)
    }

    setUploadingPhotos(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('You must be signed in.'); return }

      const uploadedUrls: string[] = []
      for (const file of toUpload) {
        if (!file.type.startsWith('image/')) {
          setPhotoError('Only image files are supported.')
          continue
        }
        if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
          setPhotoError(`${file.name} is larger than ${MAX_PHOTO_SIZE_MB}MB.`)
          continue
        }
        const ext = file.name.split('.').pop() ?? 'jpg'
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('delivery-item-photos')
          .upload(path, file, { contentType: file.type, upsert: true })
        if (uploadErr) {
          setPhotoError(uploadErr.message)
          continue
        }
        const { data: { publicUrl } } = supabase.storage.from('delivery-item-photos').getPublicUrl(path)
        uploadedUrls.push(publicUrl)
      }
      if (uploadedUrls.length > 0) {
        setItemPhotos((prev) => [...prev, ...uploadedUrls])
      }
    } finally {
      setUploadingPhotos(false)
    }
  }

  function removePhoto(url: string) {
    setItemPhotos((prev) => prev.filter((u) => u !== url))
  }

  const price = quote?.finalPrice ?? null

  // Explains exactly why the submit button is disabled, so it never just
  // silently does nothing.
  const missingReason =
    !pickupCoords ? 'Select a pickup address from the suggestions list.'
    : (!deliveryCoords && !liveLocationActive) ? 'Select a delivery address from the suggestions list, or use live location.'
    : !packageSize ? 'Select a package size below to continue.'
    : !confirmed ? 'Confirm your item is legal and safe to continue.'
    : quoteError ? quoteError
    : (!quote && !submitting) ? 'Calculating price…'
    : null

  async function handleSubmit() {
    if (submitting || checkoutLock.current) return
    if (!pickupValue || !pickupCoords) { toast.error('Select a pickup address from the suggestions list.'); return }
    if ((!deliveryValue || !deliveryCoords) && !liveLocationActive) { toast.error('Select a delivery address from the suggestions list, or use live location.'); return }
    if (!packageSize) { toast.error('Select a package size.'); return }
    if (!confirmed) { toast.error('Please confirm your item is legal and safe.'); return }
    if (quoteError) { toast.error(quoteError); return }
    if (!quote) { toast.error('Still calculating the price — please wait a moment.'); return }


    checkoutLock.current=true
    setSubmitting(true)
    try {
      const result = await startBookingCheckout({service: 'delivery', details:{
        pickup_address: pickupValue,
        delivery_address: deliveryValue,
        pickup_lat: pickupCoords.lat,
        pickup_lng: pickupCoords.lng,
        delivery_lat: deliveryCoords!.lat,
        delivery_lng: deliveryCoords!.lng,
        item_description: itemDescription.trim(),
        item_photo_urls: itemPhotos,
        package_size: packageSize,
        promo_code: quote.promoCodeText,
      }})

      if ('error' in result) { toast.error(result.error); checkoutLock.current=false; setSubmitting(false); return }
      window.location.assign(result.url)
    } catch (err) {
      checkoutLock.current=false
      toast.error(err instanceof Error ? err.message : 'Unexpected error.')
      setSubmitting(false)
    }
  }

  return (
    <div ref={frameRef} className={styles.overlay} onKeyDown={(event) => {
      if (event.key === 'Escape' && !submitting) onClose()
      if (event.key === 'Tab') {
        const controls = Array.from(frameRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)') ?? []).filter(el => el.getClientRects().length > 0)
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }}>
      <div className={styles.backdrop} />
      <section role="dialog" aria-modal="true" aria-labelledby="booking-title" className={styles.dialog}>
        <header className={styles.header}>
          <div><p>Collect &amp; Deliver</p><span>Step {step} of 3 · {['Package', 'Locations', 'Review & Pay'][step - 1]}</span></div>
          <button aria-label="Close booking" disabled={submitting} onClick={onClose}>×</button>
        </header>
        <div className={styles.progress} aria-hidden="true"><div style={{width: `${step / 3 * 100}%`}} /></div>
        <div className={styles.body}>
          <h2 id="booking-title">{['What are we delivering?', 'Where should we deliver?', 'Review your delivery'][step - 1]}</h2>
          {step === 1 && <div className={styles.packageStep}>
            <div className={styles.sizes}>          {/* Package size — determines which drivers (by vehicle) get matched */}
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
                    aria-pressed={active}
                    onClick={() => { setPackageSize(size); setStepError(null) }}
                    className={`flex flex-col items-start gap-0.5 py-2.5 px-3 rounded-xl border text-left transition-all ${
                      active
                        ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/40'
                        : 'bg-[#262626] border-[#494847]/20 hover:border-[#494847]/40'
                    }`}
                  >
                    <span className={`text-xs font-bold ${active ? 'text-[var(--color-primary)]' : 'text-white'}`}>{info.label}</span>
                    <span className="text-[10px] text-[#adaaaa] leading-snug">{info.description}</span>
                  </button>
                )
              })}
            </div>
          </div>

</div>
            <div className={styles.description}>          {/* Item description — optional */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-[#adaaaa] uppercase tracking-wider">Item Description <span className="text-[#494847] normal-case">(optional)</span></p>
              <span className="text-[10px] text-[#494847]">{itemDescription.length}/300</span>
            </div>
            <textarea
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value.slice(0, 300))}
              placeholder="Describe what's being delivered — e.g. 3 boxes of clothing, a fragile glass vase, a birthday cake…"
              rows={2}
              className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#494847] outline-none focus:border-[var(--color-primary)]/50 transition-colors resize-none"
            />
          </div>

</div>
            <div className={styles.photos}>          {/* Item photos — optional */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-[#adaaaa] uppercase tracking-wider">Item Photos <span className="text-[#494847] normal-case">(optional)</span></p>
              <span className="text-[10px] text-[#494847]">{itemPhotos.length}/{MAX_ITEM_PHOTOS}</span>
            </div>
            <div className="flex gap-2">
              {itemPhotos.map((url) => (
                <div key={url} className="relative w-12 h-12 rounded-xl overflow-hidden border border-[#494847]/20 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Item photo" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(url)}
                    className="absolute inset-0 bg-black/60 opacity-100 flex items-center justify-center transition-opacity"
                    aria-label="Remove photo"
                  >
                    <span className="material-symbols-outlined text-white text-lg">delete</span>
                  </button>
                </div>
              ))}
              {itemPhotos.length < MAX_ITEM_PHOTOS && (
                <label className={`w-12 h-12 rounded-xl border border-dashed flex items-center justify-center cursor-pointer transition-all ${
                  uploadingPhotos
                    ? 'border-[#494847]/20 opacity-50 cursor-wait'
                    : 'border-[#494847]/30 hover:border-[var(--color-primary)]/40 text-[#adaaaa] hover:text-[var(--color-primary)]'
                }`}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploadingPhotos}
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <span className="material-symbols-outlined text-xl">
                    {uploadingPhotos ? 'hourglass_empty' : 'add_a_photo'}
                  </span>
                </label>
              )}
            </div>
            {photoError && (
              <p className="text-[10px] text-red-400 mt-1.5">{photoError}</p>
            )}
          </div>

</div>
          </div>}
          {step === 2 && <div className={styles.locationStep}>          {/* Pickup */}
          <AddressInput
            label="Pickup"
            icon="radio_button_checked"
            color="text-[var(--color-primary)]"
            placeholder="Search pickup address..."
            value={pickupValue}
            onChange={(v) => { setPickupValue(v); setPickupCoords(null) }}
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
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-secondary)]">
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
                color="text-[var(--color-secondary)]"
                placeholder="Search delivery address..."
                value={deliveryValue}
                onChange={(v) => { setDeliveryValue(v); setDeliveryCoords(null) }}
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

</div>}
          {step === 3 && <div className={styles.reviewStep}>
            
          <div className={styles.summary}>
            <div><span>Pickup</span><p>{pickupValue}</p><button onClick={() => goTo(2)}>Edit</button></div>
            <div><span>Delivery</span><p>{deliveryValue}</p><button onClick={() => goTo(2)}>Edit</button></div>
            <div><span>{packageSize ? PACKAGE_SIZE_INFO[packageSize].label : 'Package'}</span><p>{itemDescription || 'No description added'}</p><button onClick={() => goTo(1)}>Edit</button></div>
          </div>
          <div className={styles.price}>
            <div><span>Base fare</span><strong>{quote ? `£${formatPrice(quote.basePrice-(quote.extraCharges??[]).reduce((sum,c)=>sum+c.amount,0))}` : '—'}</strong></div>
            {quote?.extraCharges?.map(c=><div key={c.label}><span>{c.label}</span><strong>£{formatPrice(c.amount)}</strong></div>)}
            {quote && quote.surgeMultiplier > 1 && <div><span>Surge ({quote.surgeMultiplier}×)</span><strong>+£{formatPrice(quote.surgedPrice - quote.basePrice)}</strong></div>}
            {quote && quote.discountAmount > 0 && <div><span>{quote.discountLabel}</span><strong>−£{formatPrice(quote.discountAmount)}</strong></div>}
            <div><span>Total</span><strong>{quoteLoading ? 'Calculating…' : price !== null ? `£${formatPrice(price)}` : '—'}</strong></div>
            <div><span>Payment</span><strong>Stripe card checkout</strong></div>
          </div>

                      {/* Promo code */}
          <div>
            {!showPromoInput && !quote?.discountLabel ? (
              <button
                type="button"
                onClick={() => setShowPromoInput(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-sm">local_offer</span>
                Have a promo code?
              </button>
            ) : (
              <>
                <p className="text-[10px] font-bold text-[#adaaaa] uppercase tracking-wider mb-2">Promo Code</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SUMMER10"
                    className="flex-1 bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#494847] outline-none focus:border-[var(--color-primary)]/50 transition-colors uppercase"
                  />
                  {promoCode && (
                    <button
                      type="button"
                      onClick={() => setPromoCode('')}
                      className="px-3 py-2.5 rounded-xl text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors"
                      aria-label="Clear promo code"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  )}
                </div>
                {quote?.promoCodeError && (
                  <p className="text-[10px] text-red-400 mt-1.5">{quote.promoCodeError}</p>
                )}
                {quote?.promoCodeText && quote.discountAmount > 0 && (
                  <p className="text-[10px] text-[#6ee7b7] mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">check_circle</span>
                    Code applied — £{formatPrice(quote.discountAmount)} off
                  </p>
                )}
              </>
            )}
          </div>


            <p className={styles.prohibited}>Do not send: {PROHIBITED_ITEMS.map(item => item.label.toLowerCase()).join(', ')}.</p>
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


          </div>}
        </div>
        <footer className={styles.footer}>
          {stepError && <p role="alert">{stepError}</p>}
          {step === 3 && missingReason && <p role="status">{missingReason}</p>}
          <div className={styles.actions}>
            <button disabled={submitting} onClick={() => step === 1 ? onClose() : goTo(step - 1)}>{step === 1 ? 'Cancel' : 'Back'}</button>
            {step < 3 ? <button className={styles.continue} onClick={continueStep}>Continue</button> : <>                      <button
              onClick={handleSubmit}
              disabled={submitting || !!missingReason || quoteLoading || uploadingPhotos}
              className="flex-1 py-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold text-sm hover:bg-[var(--color-primary-fixed-dim)] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ boxShadow: confirmed ? '0 0 20px rgba(var(--brand-rgb),0.25)' : 'none' }}
            >
              <span className="material-symbols-outlined text-base">bolt</span>
              {submitting ? 'Requesting…' : price !== null ? `Confirm & Pay — £${formatPrice(price)}` : 'Request Delivery'}
            </button>

</>}
          </div>
        </footer>
      </section>
    </div>
  )
}
