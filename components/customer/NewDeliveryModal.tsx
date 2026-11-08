'use client'
import { QuoteLock } from "./quote-lock"
import { getBookingPricing } from "@/app/actions/booking-settings"
import { packageSizeFee, type BookingPricing } from "@/lib/booking-pricing"
import { CancellationPolicyNotice } from "./cancellation-policy-notice"
import { newShoppingRequestId } from '@/lib/shopping-booking'
import { useOrderPhotoCleanup } from '@/hooks/use-order-photo-cleanup'
import { cleanupAbandonedOrderPhotos } from '@/app/actions/order-photo-cleanup'
import { SavedAddressPicker } from './SavedAddressPicker'

import { AddressInstructions } from "@/components/customer/address-instructions"
import { PriceBreakdown } from "@/components/customer/price-breakdown"
import styles from './DeliverySteps.module.css'
import dynamic from 'next/dynamic'
import { PackageIllustration } from './PackageIllustration'
import { ItemPhotoPreview } from './ItemPhotoPreview'
import { compressImage } from '@/lib/image-compress'
import { requestBrowserLocation, locationIssue, type LocationIssue } from '@/lib/browser-location'
import { LocationButton } from './LocationButton'
import { LocationPermissionDialog } from './LocationPermissionDialog'
const BookingRouteMap = dynamic(() => import('./BookingRouteMap'), { ssr: false })
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { startOrderCheckout } from '@/app/actions/order-checkout'
import { createWalletTopUpSession } from '@/app/actions/payments'
import { getWalletBalance } from '@/app/actions/wallet'
import { getDeliveryQuote, type DeliveryQuote } from '@/app/actions/pricing'
import { createClient } from '@/lib/supabase/client'
import { isPreciseDeliveryAddress, PRECISE_DELIVERY_ADDRESS_ERROR } from '@/lib/precise-delivery-address'
import { createAddressRequest } from '@/lib/address-request'
import { PACKAGE_SIZES, PACKAGE_SIZE_INFO, type PackageSize } from '@/lib/vehicles'
import { formatPrice } from '@/lib/pricing'
import {
  googlePlacesAutocomplete,
  googlePlaceCoords,
  googleReverseGeocode,
  type PlaceSuggestion,
} from '@/lib/google'
import { addressPostcode, parcelContact } from "@/lib/parcel-contact"
import {normaliseUKPhone} from '@/lib/uk-phone'
import { saveDeliveryDraft, type DeliveryDraft } from '@/lib/delivery-draft'

interface NewDeliveryModalProps {
  ownerId?: string
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
type LocationTarget = 'pickup' | 'destination' | 'live'

function AddressInput({
  label, icon, color, placeholder, value, onChange, onSelect,
  onGpsClick, onGpsPosition, onGpsError, getGpsVersion, gpsLoading, locationHelpOpen, proximity, countryCode,
}: {
  label: string; icon: string; color: string; placeholder: string; value: string
  onChange: (v: string) => void
  onSelect: (place: string, coords: LatLng | null) => void
  onGpsClick: () => void
  onGpsPosition: (position: GeolocationPosition) => void
  onGpsError: (error: unknown) => void
  getGpsVersion: () => number
  gpsLoading: boolean
  locationHelpOpen: boolean
  proximity: LatLng | null
  countryCode: string | null
}) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [selecting, setSelecting] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const requests = useRef(createAddressRequest()).current
  const localValue = useRef(value)
  const [searchError, setSearchError] = useState("")
  useEffect(() => {
    if (localValue.current === value) return
    localValue.current = value; requests.cancel(); setSuggestions([]); setOpen(false); setSelecting(false); setSearchError("")
  }, [value, requests])
  useEffect(() => () => requests.cancel(), [requests])

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
    localValue.current = v
    onChange(v)
    requests.cancel()
    setSuggestions([]); setOpen(false); setSelecting(false); setSearchError('')
    if (v.trim().length < 2) return
    requests.search(async signal => {
      try {
        const results = await googlePlacesAutocomplete(v.trim(), { proximity: proximity ?? undefined, countryCode, signal })
        if (signal.aborted || document.activeElement !== inputRef.current) return
        setSuggestions(results)
        if (results.length) openDropdown()
        else setSearchError('No addresses found. Try a postcode and building number.')
      } catch (error) {
        if (!signal.aborted) setSearchError(error instanceof Error ? error.message : 'Address search failed. Please retry.')
      }
    })
  }

  async function handleSelect(s: PlaceSuggestion) {
    const signal = requests.start()
    localValue.current = s.text
    onChange(s.text)
    setOpen(false); setSuggestions([]); setSelecting(true); setSearchError('')
    const coords = await googlePlaceCoords(s.placeId, signal).catch(() => null)
    if (signal.aborted) return
    const chosenPostcode=addressPostcode(s.text), resolvedPostcode=addressPostcode(coords?.address??"")
    if (coords?.address && chosenPostcode && resolvedPostcode && chosenPostcode!==resolvedPostcode) {
      if (!window.confirm(`You selected: ${s.text}\nThe map found: ${coords.address}\nUse the map address instead? Cancel to choose another address.`)) {
        setSelecting(false)
        setSearchError("The map returned a different postcode. Choose the correct address before continuing.")
        return
      }
      localValue.current=coords.address
      onSelect(coords.address,{lat:coords.lat,lng:coords.lng})
      setSelecting(false)
      inputRef.current?.blur()
      return
    }
    const address = chosenPostcode ? s.text : coords?.address ?? s.text
    localValue.current = address
    onSelect(address, coords ? {lat:coords.lat,lng:coords.lng} : null)
    setSelecting(false)
    if (coords) inputRef.current?.blur()
    else setSearchError('Could not select this address. Please try again.')
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className={styles.addressLabel}>
        <label className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${color}`}>
          <span className="material-symbols-outlined text-sm">{icon}</span>
          {label}
        </label>
        <LocationButton onRequest={onGpsClick} onPosition={onGpsPosition} onError={onGpsError} getRequestVersion={getGpsVersion}
          disabled={gpsLoading || selecting} suspended={locationHelpOpen} label={gpsLoading ? 'Locating…' : `Use my location for ${label.toLowerCase()}`} />
      </div>
      <div className="relative">
        <input
          ref={inputRef}
          data-delivery-address
          aria-label={label + " address"}
          className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#494847] outline-none focus:border-[var(--color-primary)]/50 transition-colors"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleChange(e.currentTarget.value)}
          onFocus={() => { if (suggestions.length > 0) openDropdown() }}
          autoComplete="off"
        />
        {searchError && <small role="status">{searchError}</small>}
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

export default function NewDeliveryModal({ onClose, initialDraft, focusAddress, ownerId = "" }: NewDeliveryModalProps) {
  const router = useRouter()
  const [pickupInstructions,setPickupInstructions]=useState(initialDraft?.pickupInstructions??"")
  const [deliveryInstructions,setDeliveryInstructions]=useState(initialDraft?.deliveryInstructions??"")
  const [step, setStep] = useState(initialDraft?.step === 3 ? 3 : initialDraft?.step === 2 ? 2 : 1)
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
    if(next===3)setQuoteRefresh(n=>n+1)
    setStepError(null)
    setStep(next)
  }
  function continueStep() {
    if (step === 1 && !packageSize) { setStepError('Choose a package size to continue.'); return }
    if (step === 1 && uploadingPhotos) { setStepError('Please wait for your photos to finish uploading.'); return }
    if (step === 2 && (gpsPickupLoading || gpsDestLoading || liveLocationLoading)) { setStepError('Please wait while we find your location.'); return }
    if (step === 2 && (!pickupValue || !pickupCoords)) { setStepError('Choose a pickup address from the suggestions.'); return }
    if (step === 2 && (!deliveryValue || !deliveryCoords)) { setStepError('Choose a delivery address or use your live location.'); return }
    if (step === 2 && !isPreciseDeliveryAddress(deliveryValue)) { setStepError(PRECISE_DELIVERY_ADDRESS_ERROR); return }
    if (step === 2 && contact.error) { setStepError(contact.error); return }
    goTo(step + 1)
  }
  useEffect(() => {
    if (!focusAddress || step !== 2) return
    const timer = setTimeout(() => {
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-delivery-address]'))
      if (!inputs.includes(document.activeElement as HTMLInputElement)) inputs[focusAddress === 'delivery' ? 1 : 0]?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [focusAddress, step])

  const [pickupValue, setPickupValue] = useState(initialDraft?.pickupValue ?? '')
  const [deliveryValue, setDeliveryValue] = useState(initialDraft?.deliveryValue ?? '')
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(initialDraft?.pickupCoords ?? null)
  const [deliveryCoords, setDeliveryCoords] = useState<LatLng | null>(initialDraft?.deliveryCoords ?? null)
  const [itemDescription, setItemDescription] = useState<string>(initialDraft?.itemDescription ?? '')
  const [itemPhotos, setItemPhotos] = useState<string[]>(initialDraft?.itemPhotos ?? [])
  useOrderPhotoCleanup(itemPhotos, false)
  const [recipientName,setRecipientName]=useState(initialDraft?.recipientName??"")
  const [recipientPhone,setRecipientPhone]=useState(String(initialDraft?.recipientPhone??""))
  const [collectionTime,setCollectionTime]=useState(initialDraft?.collectionTime??"asap")
  const contact=parcelContact(recipientName,recipientPhone,collectionTime==="asap" || !collectionTime ? collectionTime : new Date(collectionTime).toJSON())
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [parcelRates,setParcelRates]=useState<BookingPricing|null>(null)
  useEffect(()=>{let active=true;getBookingPricing().then(r=>{if(active)setParcelRates(r)}).catch(()=>{});return()=>{active=false}},[])
  const [packageSize, setPackageSize] = useState<PackageSize | null>(initialDraft?.packageSize ?? null)
  const [confirmed, setConfirmed] = useState(false)
  const [safetyHighlighted, setSafetyHighlighted] = useState(false)
  const safetyConfirmation = useRef<HTMLInputElement>(null)
  function showSafetyConfirmation() {
    setSafetyHighlighted(true)
    safetyConfirmation.current?.scrollIntoView({ block: 'nearest' })
    safetyConfirmation.current?.focus({ preventScroll: true })
  }
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
  const checkoutKey = useRef<string | null>(initialDraft?.checkoutKey??null)
  const [quoted, setQuote] = useState<{key:string;value:DeliveryQuote} | null>(null)
  const [promoCode, setPromoCode] = useState(initialDraft?.promoCode ?? '')
  const draft = {step,pickupValue,deliveryValue,pickupCoords,deliveryCoords,itemDescription,itemPhotos,packageSize,promoCode,pickupInstructions,deliveryInstructions,recipientName,recipientPhone,collectionTime}
  const latestDraft=useRef({ownerId,draft:{...draft,checkoutKey:checkoutKey.current}})
  latestDraft.current={ownerId,draft:{...draft,checkoutKey:checkoutKey.current}}
  useEffect(()=>{
    const timer=setTimeout(()=>saveDeliveryDraft(ownerId,{...draft,checkoutKey:checkoutKey.current}),250)
    return()=>clearTimeout(timer)
  },[ownerId,step,pickupValue,deliveryValue,pickupCoords,deliveryCoords,itemDescription,itemPhotos,packageSize,promoCode,pickupInstructions,deliveryInstructions,recipientName,recipientPhone,collectionTime])
  useEffect(()=>{
    const flush=()=>{const latest=latestDraft.current;saveDeliveryDraft(latest.ownerId,latest.draft)}
    window.addEventListener("pagehide",flush)
    return()=>{window.removeEventListener("pagehide",flush)}
  },[])
  const [quoteRefresh,setQuoteRefresh]=useState(0)
  const [quoteRenewed,setQuoteRenewed]=useState(false)
  const quoteKey = JSON.stringify([pickupCoords, deliveryCoords, packageSize, promoCode.trim()])
  const quote = quoted?.key === quoteKey ? quoted.value : null
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
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
        setQuote({key:quoteKey,value:result.data})
        setQuoteError(null)
      } else {
        setQuote(null)
        setQuoteError(result.error)
      }
      setQuoteLoading(false)
    }, 400)
    return () => { current = false; clearTimeout(timer) }
  }, [pickupCoords, deliveryCoords, packageSize, promoCode, quoteKey,quoteRefresh])

  useEffect(()=>{
    if(!quote?.expiresAt)return
    const timer=setTimeout(()=>{setQuote(null);setQuoteRenewed(true);setConfirmed(false);setQuoteRefresh(n=>n+1)},Math.max(0,quote.expiresAt-Date.now()))
    return()=>clearTimeout(timer)
  },[quote?.expiresAt])

  // User's device GPS + detected country
  const [userCoords, setUserCoords] = useState<LatLng | null>(null)
  const countryCode = null // Keep address search available even when GPS permission is blocked.
  const [gpsPickupLoading, setGpsPickupLoading] = useState(false)
  const [gpsDestLoading, setGpsDestLoading] = useState(false)

  const [locationRecovery, setLocationRecovery] = useState<{ target: LocationTarget; issue: LocationIssue } | null>(null)
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

  function reportLocationIssue(target: LocationTarget, error: unknown) {
    if (locationMounted.current) setLocationRecovery({ target, issue: locationIssue(error) })
  }

  function useLocation(target: LocationTarget, position?: GeolocationPosition) {
    setLocationRecovery(null)
    if (target === 'live') void startLiveLocation(true, position)
    else void fillFromGps(target, position)
  }

  function cancelGps(field: 'pickup' | 'destination') {
    locationRequests.current[field]++
    if (field === 'pickup') setGpsPickupLoading(false)
    else { setGpsDestLoading(false); setLiveLocationError(null) }
  }

  async function fillFromGps(field: 'pickup' | 'destination', position?: GeolocationPosition) {
    cancelGps(field)
    const request = locationRequests.current[field]
    const current = () => locationMounted.current && request === locationRequests.current[field]
    const loading = field === 'pickup' ? setGpsPickupLoading : setGpsDestLoading
    loading(true)
    try {
      const pos = position ?? await requestBrowserLocation()
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
    } catch (error) { if (current()) reportLocationIssue(field, error) }
    finally { if (current()) loading(false) }
  }

  async function startLiveLocation(restart = false, position?: GeolocationPosition) {
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
      const pos = position ?? await requestBrowserLocation()
      if (!current()) return
      const point = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      const applyPosition = (p: LatLng) => {
        setUserCoords(p)
        setDeliveryCoords(previous => previous?.lat === p.lat && previous.lng === p.lng ? previous : p)
        setDeliveryValue(`${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`)
      }
      applyPosition(point)
      // Before booking, GPS updates this draft's destination only.
      // Sharing starts explicitly on the selected order's tracking screen.
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
        syncing = false

      }, error => {
        if (!current()) return
        setLiveLocationError(locationIssue(error))
        if (error.code === 1) {
          if (liveWatch.current !== null) navigator.geolocation.clearWatch(liveWatch.current)
          liveWatch.current = null
          locationRequests.current.live++
          setLiveLocationActive(false)
        }
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 })
    } catch (error) { if (current()) reportLocationIssue('live', error) }
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
        const path = `${user.id}/${newShoppingRequestId()}.jpg`
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
    void cleanupAbandonedOrderPhotos([url]).catch(()=>{})
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
    : quoteError ? quoteError
    : (!quote && !submitting) ? 'Calculating price…'
    : null

  async function handleSubmit() {
    if (submitting || success) return
    if (!pickupValue || !pickupCoords) { toast.error('Select a pickup address from the suggestions list.'); return }
    if ((!deliveryValue || !deliveryCoords) && !liveLocationActive) { toast.error('Select a delivery address from the suggestions list, or use live location.'); return }
    if (!isPreciseDeliveryAddress(deliveryValue)) { toast.error(PRECISE_DELIVERY_ADDRESS_ERROR); return }
    if (!packageSize) { toast.error('Select a package size.'); return }
    if (contact.error) { toast.error(contact.error); goTo(2); return }
    if (!confirmed) { showSafetyConfirmation(); return }
    if (quoteError) { toast.error(quoteError); return }
    if (!quote) { toast.error('Still calculating the price — please wait a moment.'); return }
    if (quote.expiresAt && quote.expiresAt <= Date.now()) { setQuoteRenewed(true); setConfirmed(false); setQuoteRefresh(n=>n+1); return }
    if (insufficientFunds) { handleAddFunds(); return }

    setSubmitting(true)
    try {
      checkoutKey.current ??= newShoppingRequestId()
      saveDeliveryDraft(ownerId,{...draft,checkoutKey:checkoutKey.current})
      const result = await startOrderCheckout({ requestKey: checkoutKey.current, type: "delivery", order: {
        ...contact,
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
        promo_code: promoCode.trim()||null,
      } })

      if ('error' in result) { if(result.restartCheckout)checkoutKey.current=null; if(/quote.*expired/i.test(result.error)){setQuoteRenewed(true);setConfirmed(false);setQuoteRefresh(n=>n+1)};toast.error(result.error); setSubmitting(false); return }
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
      saveDeliveryDraft(ownerId,{...draft,checkoutKey:checkoutKey.current})
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
        <footer className={styles.footer}>
          <div className={styles.actions}>
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
        const controls = Array.from(frameRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), geolocation, input:not(:disabled), textarea:not(:disabled)') ?? []).filter(el => el.getClientRects().length > 0)
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
        <div ref={bodyRef} className={styles.body} data-step={step}>
          {stepError && <p role="alert" className={styles.stepError}>{stepError}</p>}
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
                    <strong>{info.label}</strong><small>{parcelRates?`+£${packageSizeFee(parcelRates,size).toFixed(2)}`:"Fee shown in review"}</small>
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
          <SavedAddressPicker label="Saved pickup address" onSelect={p => { cancelGps('pickup'); setPickupValue(p.address); setPickupCoords({lat:p.lat,lng:p.lng}) }} />
          <AddressInput
            label="Pickup location"
            icon="radio_button_checked"
            color="text-[var(--color-primary)]"
            placeholder="Search pickup address..."
            value={pickupValue}
            onChange={(v) => { cancelGps('pickup'); setPickupValue(v); setPickupCoords(null) }}
            onSelect={(place, coords) => { cancelGps('pickup'); setPickupValue(place); setPickupCoords(coords ?? null) }}
            onGpsClick={() => useLocation('pickup')}
            onGpsPosition={position => useLocation('pickup', position)}
            onGpsError={error => reportLocationIssue('pickup', error)}
            getGpsVersion={() => locationRequests.current.pickup}
            gpsLoading={gpsPickupLoading}
            locationHelpOpen={!!locationRecovery}
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
                    <p className="text-xs font-bold text-cyan-400">Your current GPS destination</p>
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
              <SavedAddressPicker label="Saved delivery address" onSelect={p => { cancelGps('destination'); locationRequests.current.live++; stopLiveLocation(); setDeliveryValue(p.address); setDeliveryCoords({lat:p.lat,lng:p.lng}) }} />
              <AddressInput
                label="Delivery location"
                icon="location_on"
                color="text-[var(--color-secondary)]"
                placeholder="Search delivery address..."
                value={deliveryValue}
                onChange={(v) => { cancelGps('destination'); locationRequests.current.live++; setLiveLocationLoading(false); setDeliveryValue(v); setDeliveryCoords(null) }}
                onSelect={(place, coords) => { cancelGps('destination'); setDeliveryValue(place); setDeliveryCoords(coords ?? null) }}
                onGpsClick={() => useLocation('destination')}
                onGpsPosition={position => useLocation('destination', position)}
                onGpsError={error => reportLocationIssue('destination', error)}
                getGpsVersion={() => locationRequests.current.destination}
                gpsLoading={gpsDestLoading || liveLocationLoading}
                locationHelpOpen={!!locationRecovery}
                proximity={userCoords}
                countryCode={countryCode}
              />
              {/* Live location as alternative to typing destination */}
              <div className={styles.liveLocationAction}>
                <span>Use a moving GPS destination</span>
                <LocationButton onRequest={() => useLocation('live')} onPosition={position => useLocation('live', position)}
                  onError={error => reportLocationIssue('live', error)} disabled={liveLocationLoading || gpsDestLoading}
                  suspended={!!locationRecovery}
                  getRequestVersion={() => `${locationRequests.current.destination}:${locationRequests.current.live}`}
                  label={liveLocationLoading ? 'Locating…' : 'Use my live location as destination'} />
              </div>

            </div>
          )}

{liveLocationError && <div className={styles.locationFeedback}><p role="status">{liveLocationError.message}</p><button type="button" onClick={() => setLocationRecovery({ target: 'live', issue: liveLocationError })}>Reconnect live location</button></div>}
<fieldset className="grid gap-2 rounded-xl border border-white/20 p-3 text-sm">
<legend>Recipient and collection</legend>
<label>Recipient name <input className="block w-full rounded bg-[#262626] p-2" maxLength={100} autoComplete="off" value={recipientName} onChange={e=>setRecipientName(e.target.value)} /></label>
<label>Recipient UK phone <input className="block w-full rounded bg-[#262626] p-2" type="tel" inputMode="tel" autoComplete="tel-national" name="recipient_phone" maxLength={40} value={recipientPhone} onBlur={()=>{const phone=normaliseUKPhone(recipientPhone);if(phone)setRecipientPhone(phone)}} onChange={e=>setRecipientPhone(e.target.value)} /></label>
<label>Collection time <select className="block w-full rounded bg-[#262626] p-2" value={collectionTime==="asap"?"asap":"later"} onChange={e=>setCollectionTime(e.target.value==="asap"?"asap":"")}><option value="asap">As soon as possible</option><option value="later">Request a date and time</option></select></label>
{collectionTime!=="asap"&&<label>Preferred date and time (your device’s time zone)<input className="block w-full rounded bg-[#262626] p-2" type="datetime-local" value={collectionTime} onChange={e=>setCollectionTime(e.target.value)} /></label>}
</fieldset>
<AddressInstructions pickup={pickupInstructions} delivery={deliveryInstructions} onPickup={setPickupInstructions} onDelivery={setDeliveryInstructions}/>
<BookingRouteMap pickup={pickupCoords} destination={deliveryCoords} userLocation={userCoords}/>
</div>}
          {step === 3 && <div className={styles.reviewStep}>

          <div className={styles.summary}>
            <div><span>Pickup</span><p>{pickupValue}</p><button onClick={() => goTo(2)}>Edit</button></div>
            <div><span>Delivery</span><p>{deliveryValue}<br/>{recipientName} · {recipientPhone}<br/>{collectionTime==="asap"?"Collect as soon as possible":`Preferred collection: ${collectionTime.replace("T"," ")}`}</p><button onClick={() => goTo(2)}>Edit</button></div>
            <div className={styles.reviewPackage}>{packageSize && <span className={styles.reviewParcel} data-size={packageSize}><PackageIllustration bulky={packageSize === "bulky"}/></span>}<span>{packageSize ? PACKAGE_SIZE_INFO[packageSize].label : 'Package'}</span><p>{itemDescription || 'No description added'}</p><button onClick={() => goTo(1)}>Edit</button></div>
          </div>
          <div className={styles.price}>
            {quote?.expiresAt && <QuoteLock expiresAt={quote.expiresAt}/>} {quoteRenewed && <p role="status">The previous quote expired. Review and confirm the updated total before paying.</p>}{quoteError&&<button type="button" onClick={()=>setQuoteRefresh(n=>n+1)}>Refresh price</button>}{quote && <div><span>Driving distance</span><strong>{quote.distanceMiles.toFixed(3)} miles</strong></div>}
            <div><span>Delivery subtotal</span><strong>{quote ? `£${formatPrice(quote.basePrice)}` : '—'}</strong></div>
            {quote && <PriceBreakdown lines={quote.priceLines.some(line => /^Parcel size surcharge$/.test(line.label)) ? quote.priceLines : [...quote.priceLines,{label:"Parcel size fee",amount:0}]}/>}
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
            <p className={styles.prohibited}>By confirming below, you declare that your parcel contains no prohibited, illegal or dangerous items and accept responsibility for its contents.</p>
            <CancellationPolicyNotice/>
          </div>}
        </div>
        <footer className={styles.footer} data-review={step === 3}>
          {step === 3 && missingReason && <p role="status">{missingReason}</p>}
          {step === 3 && <label className={styles.safetyConfirmation} data-highlighted={safetyHighlighted}>
            <input ref={safetyConfirmation} type="checkbox" checked={confirmed} required
              onChange={e => { setConfirmed(e.target.checked); setSafetyHighlighted(false) }} />
            <span>Confirm your item is legal and safe</span>
          </label>}
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
              onClick={() => confirmed ? void handleSubmit() : showSafetyConfirmation()}
              aria-disabled={!confirmed || undefined}
              disabled={submitting || uploadingPhotos || (confirmed && (!!missingReason || quoteLoading))}
              className="flex-1 py-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold text-sm hover:bg-[var(--color-primary-fixed-dim)] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ boxShadow: confirmed ? '0 0 20px rgba(var(--brand-rgb),0.25)' : 'none' }}
            >
              <span className="material-symbols-outlined text-base">bolt</span>
              {submitting ? 'Requesting…' : price !== null ? `Confirm & Pay £${formatPrice(price)}` : 'Confirm & Pay'}
            </button>
          )}
</>}
          </div>
          {step === 3 && <p className={styles.secure}>Secure card checkout</p>}
        </footer>
      </section>
      {locationRecovery && <LocationPermissionDialog issue={locationRecovery.issue}
        onClose={() => setLocationRecovery(null)} onRetry={() => useLocation(locationRecovery.target)}
        onPosition={position => useLocation(locationRecovery.target, position)}
        onError={error => reportLocationIssue(locationRecovery.target, error)} />}
    </div>
  )
}
