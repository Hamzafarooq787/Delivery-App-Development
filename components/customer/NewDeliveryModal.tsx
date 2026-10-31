'use client'

import { AddressInstructions } from "@/components/customer/address-instructions"
import { PriceBreakdown } from "@/components/customer/price-breakdown"
import { useBookingDraft } from "@/hooks/use-booking-draft"
import styles from './DeliverySteps.module.css'
import dynamic from 'next/dynamic'
import { PackageIllustration } from './PackageIllustration'
import { ItemPhotoPreview } from './ItemPhotoPreview'
import { compressImage } from '@/lib/image-compress'
import { requestBrowserLocation, locationIssue, type LocationIssue } from '@/lib/browser-location'
const BookingRouteMap = dynamic(() => import('./BookingRouteMap'), { ssr: false })
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateCustomerLocation, clearCustomerLocation } from '@/app/actions/tracking'
import { startOrderCheckout } from '@/app/actions/order-checkout'
import { createWalletTopUpSession } from '@/app/actions/payments'
import { getWalletBalance } from '@/app/actions/wallet'
import { getDeliveryQuote, type DeliveryQuote } from '@/app/actions/pricing'
import { createClient } from '@/lib/supabase/client'
import { PACKAGE_SIZES, PACKAGE_SIZE_INFO, type PackageSize } from '@/lib/vehicles'
import { formatPrice } from '@/lib/pricing'
import {
  googlePlacesAutocomplete,
  googlePlaceCoords,
  googleReverseGeocode,
  type PlaceSuggestion,
} from '@/lib/google'
import { clearDeliveryDraft, saveDeliveryDraft, type DeliveryDraft } from '@/lib/delivery-draft'

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
  onGpsClick, gpsLoading, proximity, countryCode, issue,
}: {
  label: string; icon: string; color: string; placeholder: string; value: string
  onChange: (v: string) => void
  onSelect: (place: string, coords: LatLng | null) => void
  onGpsClick: () => void
  gpsLoading: boolean
  proximity: LatLng | null
  countryCode: string | null
  issue?: LocationIssue | null
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
      <div className={styles.addressLabel}>
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
      {issue && <LocationFeedback issue={issue} onRetry={onGpsClick} />}
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
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void handleSelect(s)}
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

function LocationFeedback({ issue, onRetry }: { issue: LocationIssue; onRetry: () => void }) {
  return <div className={styles.locationFeedback}>
    <p role="alert">{issue.message}</p>
    {issue.help && <details><summary>How to allow location</summary><p>{issue.help}</p></details>}
    <button type="button" onClick={onRetry}>Try again</button>
  </div>
}

export default function NewDeliveryModal({ onClose, initialDraft, focusAddress }: NewDeliveryModalProps) {
  const router = useRouter()
  const [pickupInstructions,setPickupInstructions]=useState("")
  const [deliveryInstructions,setDeliveryInstructions]=useState("")
  const [step, setStep] = useState(1)
  const [success, setSuccess] = useState<{ id: string; tracking_number: string } | null>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    frameRef.current?.querySelector<HTMLElement>('[aria-label="Close booking"]')?.focus()
    return () => previous?.focus()
  }, [])
  const [stepError, setStepError] = useState<string | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // The old step's scroll position must never clip the new step's heading.
    if (bodyRef.current) bodyRef.current.scrollTop = 0
    bodyRef.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
  }, [step])
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
    if(next < step) checkoutKey.current = null
    setStepError(null)
    setStep(next)
  }
  function continueStep() {
    if (step === 1 && !packageSize) { setStepError('Choose a package size to continue.'); return }
    if (step === 1 && uploadingPhotos) { setStepError('Please wait for your photos to finish uploading.'); return }
    if (step === 2 && (gpsPickupLoading || gpsDestLoading || liveLocationLoading)) { setStepError('Please wait while we find your location.'); return }
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

  // Wallet balance — must cover the delivery price before an order can be
  // placed. This is a UX gate only; the server re-checks and deducts
  // atomically, so a stale/bypassed client value can't create a free order.
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [addingFunds, setAddingFunds] = useState(false)

  useEffect(() => {
    getWalletBalance().then((res) => setWalletBalance(res.balance)).catch(() => setWalletBalance(null))
  }, [])

  // Authoritative price quote — computed server-side from distance, live
  // surge factors, and any discount. This is what actually gets charged;
  // nothing about price is trusted from the client at submission time.
  const checkoutKey = useRef<string | null>(null)
  const [quote, setQuote] = useState<DeliveryQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState(initialDraft?.promoCode ?? '')
  const [showPromoInput, setShowPromoInput] = useState(false)

  useEffect(() => {
    if (!pickupCoords || !deliveryCoords || !packageSize) {
      setQuote(null)
      setQuoteError(null)
      setQuoteLoading(false)
      return
    }
    let current = true
    setQuoteLoading(true)
    setQuote(null)
    setQuoteError(null)
    const timer = setTimeout(async () => {
      const result = await getDeliveryQuote({
        pickupLat: pickupCoords.lat,
        pickupLng: pickupCoords.lng,
        deliveryLat: deliveryCoords.lat,
        deliveryLng: deliveryCoords.lng,
        packageSize,
        promoCode: promoCode.trim() || null,
      }).catch(() => ({ error: 'Could not calculate the price. Check your connection and try again.' }))
      if (!current) return
      if ('data' in result) {
        setQuote(result.data)
        setQuoteError(null)
      } else {
        setQuote(null)
        setQuoteError(result.error)
      }
      setQuoteLoading(false)
    }, 400)
    return () => { current = false; clearTimeout(timer) }
  }, [pickupCoords, deliveryCoords, packageSize, promoCode])

  // User's device GPS + detected country
  const [userCoords, setUserCoords] = useState<LatLng | null>(null)
  const countryCode = null // Keep address search available even when GPS permission is blocked.
  const [gpsPickupLoading, setGpsPickupLoading] = useState(false)
  const [gpsDestLoading, setGpsDestLoading] = useState(false)

  const [pickupLocationIssue, setPickupLocationIssue] = useState<LocationIssue | null>(null)
  const [deliveryLocationIssue, setDeliveryLocationIssue] = useState<LocationIssue | null>(null)
  const [liveLocationActive, setLiveLocationActive] = useState(false)
  const [liveLocationLoading, setLiveLocationLoading] = useState(false)
  const [liveLocationError, setLiveLocationError] = useState<LocationIssue | null>(null)
  const locationRequests = useRef({ pickup: 0, destination: 0, live: 0 })
  const liveWatch = useRef<number | null>(null)
  const locationMounted = useRef(true)

  useEffect(() => {
    locationMounted.current = true
    return () => {
      locationMounted.current = false
      locationRequests.current.live++
      locationRequests.current.pickup++
      locationRequests.current.destination++
      if (liveWatch.current !== null) navigator.geolocation.clearWatch(liveWatch.current)
    }
  }, [])

  function cancelGps(field: 'pickup' | 'destination') {
    locationRequests.current[field]++
    if (field === 'pickup') { setGpsPickupLoading(false); setPickupLocationIssue(null) }
    else { setGpsDestLoading(false); setDeliveryLocationIssue(null); setLiveLocationError(null) }
  }

  async function fillFromGps(field: 'pickup' | 'destination') {
    cancelGps(field)
    const request = locationRequests.current[field]
    const current = () => locationMounted.current && request === locationRequests.current[field]
    const loading = field === 'pickup' ? setGpsPickupLoading : setGpsDestLoading
    const setIssue = field === 'pickup' ? setPickupLocationIssue : setDeliveryLocationIssue
    loading(true)
    try {
      const pos = await requestBrowserLocation()
      if (!current()) return
      const point = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      const fallback = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`
      setUserCoords(point)
      if (field === 'pickup') { setPickupCoords(point); setPickupValue(fallback) }
      else { setDeliveryCoords(point); setDeliveryValue(fallback) }
      // Coordinates are usable immediately, even if address lookup is unavailable.
      loading(false)
      const place = await googleReverseGeocode(point.lat, point.lng).catch(() => null)
      if (place && current()) {
        if (field === 'pickup') setPickupValue(place)
        else setDeliveryValue(place)
      }
    } catch (error) { if (current()) setIssue(locationIssue(error)) }
    finally { if (current()) loading(false) }
  }

  async function startLiveLocation(restart = false) {
    if (liveLocationLoading || (liveLocationActive && !restart)) return
    if (liveWatch.current !== null) navigator.geolocation.clearWatch(liveWatch.current)
    liveWatch.current = null
    setLiveLocationActive(false)
    cancelGps('destination')
    const request = ++locationRequests.current.live
    const current = () => locationMounted.current && request === locationRequests.current.live
    setLiveLocationError(null)
    setLiveLocationLoading(true)
    try {
      const pos = await requestBrowserLocation()
      if (!current()) return
      const point = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      const applyPosition = (p: LatLng) => {
        setUserCoords(p)
        setDeliveryCoords(previous => previous?.lat === p.lat && previous.lng === p.lng ? previous : p)
        setDeliveryValue(`${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`)
      }
      applyPosition(point)
      const saved = await updateCustomerLocation(point)
      if (!current()) return
      if ('error' in saved) throw new Error('Your location was found, but live sharing could not start. Try again or use the address above.')
      setLiveLocationActive(true)
      // A watch has a bounded timeout and is always cancelled on stop/unmount.
      let lastSent = Date.now()
      let syncing = false
      let revision = 0
      const refreshAddress = async (p: LatLng) => {
        const version = ++revision
        const place = await googleReverseGeocode(p.lat, p.lng).catch(() => null)
        if (current() && version === revision && place) setDeliveryValue(place)
      }
      void refreshAddress(point)
      liveWatch.current = navigator.geolocation.watchPosition(async next => {
        if (!current() || syncing || Date.now() - lastSent < 5000) return
        syncing = true; lastSent = Date.now()
        const p = { lat: next.coords.latitude, lng: next.coords.longitude }
        applyPosition(p)
        void refreshAddress(p)
        try {
          const result = await updateCustomerLocation(p)
          if (current()) setLiveLocationError('error' in result ? { message: 'Live sharing could not update. Check your connection. Your last location is kept.' } : null)
        } catch { if (current()) setLiveLocationError({ message: 'Live sharing could not update. Check your connection. Your last location is kept.' }) }
        finally { syncing = false }
      }, error => {
        if (!current()) return
        setLiveLocationError(locationIssue(error))
        if (error.code === 1) {
          if (liveWatch.current !== null) navigator.geolocation.clearWatch(liveWatch.current)
          liveWatch.current = null
          locationRequests.current.live++
          setLiveLocationActive(false)
          void clearCustomerLocation().catch(() => {})
        }
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 })
    } catch (error) { if (current()) setLiveLocationError(locationIssue(error)) }
    finally { if (current()) setLiveLocationLoading(false) }
  }

  async function stopLiveLocation() {
    locationRequests.current.live++
    if (liveWatch.current !== null) navigator.geolocation.clearWatch(liveWatch.current)
    liveWatch.current = null
    setLiveLocationActive(false)
    setLiveLocationLoading(false)
    setLiveLocationError(null)
    // Keep the last address available for editing instead of discarding it.
    await clearCustomerLocation().catch(() => {})
  }

  // Upload selected item photos directly to Supabase Storage — the delivery
  // doesn't exist yet at this point, so photos live under the customer's own
  // folder and their public URLs are attached to the delivery on submit.
  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0 || uploadingPhotos) return

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
        let compressed: Blob
        try { compressed = await compressImage(file, 1280, 0.82) }
        catch (error) { setPhotoError(error instanceof Error ? error.message : 'Could not prepare this photo.'); continue }
        const path = `${user.id}/${crypto.randomUUID()}.jpg`
        const { error: uploadErr } = await supabase.storage
          .from('delivery-item-photos')
          .upload(path, compressed, { contentType: compressed.type, upsert: false })
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
    } catch {
      setPhotoError('Photo upload failed. Check your connection and try again.')
    } finally {
      setUploadingPhotos(false)
    }
  }

  function removePhoto(url: string) {
    setItemPhotos((prev) => prev.filter((u) => u !== url))
  }

  const price = quote?.finalPrice ?? null
  const insufficientFunds = false

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

  const persistBooking = useBookingDraft('delivery', {pickupValue,deliveryValue,pickupCoords,deliveryCoords,itemDescription,itemPhotos,packageSize,promoCode,pickupInstructions,deliveryInstructions}, draft=>{
    if(initialDraft)return
    setPickupInstructions(draft.pickupInstructions??"");setDeliveryInstructions(draft.deliveryInstructions??"")
    setPickupValue(draft.pickupValue);setDeliveryValue(draft.deliveryValue);setPickupCoords(draft.pickupCoords);setDeliveryCoords(draft.deliveryCoords);setItemDescription(draft.itemDescription);setItemPhotos(draft.itemPhotos);setPackageSize(draft.packageSize);setPromoCode(draft.promoCode)
  })
  async function handleSubmit() {
    if (submitting || success) return
    if (!pickupValue || !pickupCoords) { toast.error('Select a pickup address from the suggestions list.'); return }
    if ((!deliveryValue || !deliveryCoords) && !liveLocationActive) { toast.error('Select a delivery address from the suggestions list, or use live location.'); return }
    if (!packageSize) { toast.error('Select a package size.'); return }
    if (!confirmed) { toast.error('Please confirm your item is legal and safe.'); return }
    if (quoteError) { toast.error(quoteError); return }
    if (!quote) { toast.error('Still calculating the price — please wait a moment.'); return }
    if (insufficientFunds) { handleAddFunds(); return }

    setSubmitting(true)
    try {
      persistBooking()
      checkoutKey.current ??= crypto.randomUUID()
      const result = await startOrderCheckout({ requestKey: checkoutKey.current, type: "delivery", order: {
        pickup_instructions:pickupInstructions,delivery_instructions:deliveryInstructions,
        consent_token: quote.consentToken,
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
      } })

      if ('error' in result) { toast.error(result.error); setSubmitting(false); return }
      window.location.assign(result.url)
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
        itemDescription,
        itemPhotos,
        packageSize,
        promoCode,
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

  if (success) return (
    <div ref={frameRef} className={styles.overlay}>
      <div className={styles.backdrop} />
      <section role="dialog" aria-modal="true" aria-labelledby="delivery-success-title" className={styles.dialog}>
        <header className={styles.header}><p>Collect &amp; Deliver</p><button autoFocus aria-label="Close confirmation" onClick={onClose}>×</button></header>
        <div className={styles.success} role="status">
          <span className={styles.successMark} aria-hidden="true">✓</span>
          <h2 id="delivery-success-title">Thank you!</h2>
          <p>Your delivery has been booked.</p>
          <div className={styles.receipt}><span>Tracking code</span><strong>{success.tracking_number}</strong></div>
          <p>We’ll let you know when a driver accepts your delivery.</p>
        </div>
        <footer className={styles.footer}><div className={styles.actions}>
          <button onClick={onClose}>Done</button>
          <button className={styles.continue} onClick={() => { onClose(); router.push(`/dashboard/customer/tracking?id=${encodeURIComponent(success.id)}`) }}>Track delivery</button>
        </div></footer>
      </section>
    </div>
  )

  return (
    <div ref={frameRef} className={styles.overlay} onKeyDown={(event) => {
      if (event.key === 'Escape' && !submitting && !addingFunds) onClose()
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
          <div><p className={styles.wordmark}><b>Go</b>Drop</p><span>{step} of 3 · {['Package', 'Locations', 'Review & Pay'][step - 1]}</span></div>
          <button aria-label="Close booking" disabled={submitting} onClick={onClose}>×</button>
        </header>
        <div className={styles.progress} aria-hidden="true"><div style={{width: `${step / 3 * 100}%`}} /></div>
        <div ref={bodyRef} className={styles.body}>
          <h2 id="booking-title" tabIndex={-1}>{['What are you sending?', 'Where should we collect and deliver?', 'Check your order'][step - 1]}</h2>
          {step === 1 && <div className={styles.packageStep}>
            <div className={styles.sizes}>          {/* Package size — determines which drivers (by vehicle) get matched */}
          <div>

            <div className={styles.packageGrid}>
              {PACKAGE_SIZES.map((size) => {
                const active = packageSize === size
                const info = PACKAGE_SIZE_INFO[size]
                return (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={active}
                    onClick={() => { setPackageSize(size); setStepError(null) }}
                    className={styles.packageCard}
                    title={info.description}
                  >
                    {active && <span className={styles.selectedMark} aria-hidden="true">✓</span>}
                    <span className={styles.parcel} data-size={size}><PackageIllustration bulky={size === 'bulky'}/></span>
                    <strong>{info.label}</strong>
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
              id="item-description"
              aria-label="Item description"
              placeholder="e.g. 2 boxes of clothes"
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
            <div className={styles.photoList}>
              {itemPhotos.map((url, index) => (
                <ItemPhotoPreview key={url} url={url} label={`Item photo ${index + 1}`} onRemove={() => removePhoto(url)} />
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
                    className="sr-only"
                    aria-label="Add item photos"
                  />
                  <span className="material-symbols-outlined text-xl">
                    {uploadingPhotos ? 'hourglass_empty' : 'add_a_photo'}
                  </span><span className={styles.photoLabel}>{uploadingPhotos ? 'Preparing…' : 'Add photo'}</span>
                </label>
              )}
            </div>
            <p className={styles.photoHint}>Photos are compressed automatically. Tap a photo to enlarge.</p>
            {photoError && (
              <p className="text-[10px] text-red-400 mt-1.5">{photoError}</p>
            )}
          </div>

</div>
          </div>}
          {step === 2 && <div className={styles.locationStep}>          {/* Pickup */}
          <AddressInput
            label="Pickup location"
            icon="radio_button_checked"
            color="text-[var(--color-primary)]"
            placeholder="Search pickup address..."
            value={pickupValue}
            onChange={(v) => { cancelGps('pickup'); setPickupValue(v); setPickupCoords(null) }}
            onSelect={(place, coords) => { cancelGps('pickup'); setPickupValue(place); setPickupCoords(coords ?? null) }}
            onGpsClick={() => fillFromGps('pickup')}
            gpsLoading={gpsPickupLoading}
            issue={pickupLocationIssue}
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
                label="Delivery location"
                icon="location_on"
                color="text-[var(--color-secondary)]"
                placeholder="Search delivery address..."
                value={deliveryValue}
                onChange={(v) => { cancelGps('destination'); locationRequests.current.live++; setLiveLocationLoading(false); setDeliveryValue(v); setDeliveryCoords(null) }}
                onSelect={(place, coords) => { cancelGps('destination'); setDeliveryValue(place); setDeliveryCoords(coords ?? null) }}
                onGpsClick={() => fillFromGps('destination')}
                gpsLoading={gpsDestLoading || liveLocationLoading}
                issue={deliveryLocationIssue}
                proximity={userCoords}
                countryCode={countryCode}
              />
              {/* Live location as alternative to typing destination */}
              <button
                type="button"
                onClick={() => void startLiveLocation()}
                disabled={liveLocationLoading || gpsDestLoading}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-dashed border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/5 transition-all"
              >
                <span className="material-symbols-outlined text-base">share_location</span>
                <span className="text-xs font-bold">{liveLocationLoading ? 'Finding your live location…' : 'Use my live location as destination'}</span>
              </button>

            </div>
          )}

{liveLocationError && <LocationFeedback issue={liveLocationError} onRetry={() => void startLiveLocation(true)} />}
<AddressInstructions pickup={pickupInstructions} delivery={deliveryInstructions} onPickup={setPickupInstructions} onDelivery={setDeliveryInstructions}/>
<BookingRouteMap pickup={pickupCoords} destination={deliveryCoords} userLocation={userCoords}/>
</div>}
          {step === 3 && <div className={styles.reviewStep}>

          <div className={styles.summary}>
            <div><span>Pickup</span><p>{pickupValue}</p><button onClick={() => goTo(2)}>Edit</button></div>
            <div><span>Delivery</span><p>{deliveryValue}</p><button onClick={() => goTo(2)}>Edit</button></div>
            <div className={styles.reviewPackage}>{packageSize && <span className={styles.reviewParcel}><PackageIllustration bulky={packageSize === "bulky"}/></span>}<span>{packageSize ? PACKAGE_SIZE_INFO[packageSize].label : 'Package'}</span><p>{itemDescription || 'No description added'}</p><button onClick={() => goTo(1)}>Edit</button></div>
          </div>
          <div className={styles.price}>
            <div><span>Delivery subtotal</span><strong>{quote ? `£${formatPrice(quote.basePrice)}` : '—'}</strong></div>
            {quote && <PriceBreakdown lines={quote.priceLines}/>}
            {quote && quote.surgeMultiplier > 1 && <div><span>Surge ({quote.surgeMultiplier}×)</span><strong>+£{formatPrice(quote.surgedPrice - quote.basePrice)}</strong></div>}
            {quote && quote.discountAmount > 0 && <div><span>{quote.discountLabel}</span><strong>−£{formatPrice(quote.discountAmount)}</strong></div>}
            <div><span>Total</span><strong>{quoteLoading ? 'Calculating…' : price !== null ? `£${formatPrice(price)}` : '—'}</strong></div>
            <div><span>Payment</span><strong>Secure card checkout</strong></div>
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
            <button disabled={submitting || addingFunds} onClick={() => step === 1 ? onClose() : goTo(step - 1)}>{step === 1 ? 'Cancel' : 'Back'}</button>
            {step < 3 ? <button className={styles.continue} onClick={continueStep}>Continue</button> : <>          {insufficientFunds ? (
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
              disabled={submitting || !!missingReason || quoteLoading || uploadingPhotos}
              className="flex-1 py-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold text-sm hover:bg-[var(--color-primary-fixed-dim)] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ boxShadow: confirmed ? '0 0 20px rgba(var(--brand-rgb),0.25)' : 'none' }}
            >
              <span className="material-symbols-outlined text-base">bolt</span>
              {submitting ? 'Requesting…' : price !== null ? `Confirm & Pay £${formatPrice(price)}` : 'Request Delivery'}
            </button>
          )}
</>}
          </div>
          {step === 3 && <p className={styles.secure}>Secure card checkout</p>}
        </footer>
      </section>
    </div>
  )
}
