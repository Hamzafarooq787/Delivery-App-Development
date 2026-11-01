'use client'
import {timelineTime} from '@/lib/timeline-time'
import {OrderRecoveryInstructions} from "@/components/shared/order-recovery-instructions"
import { orderMediaUrl } from '@/lib/order-media'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/customer/Header'
import navStyles from '@/components/customer/CustomerNavigation.module.css'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'
import { CustomerLocationBroadcaster } from '@/components/tracking/customer-location-broadcaster'
import { CollectionWaiting } from '@/components/driver/collection-waiting'
import { CustomerThread } from '@/components/shared/customer-thread'
import { CustomerShoppingOrder } from '@/components/customer/CustomerShoppingOrder'
import { getDriverNamesByIds } from '@/app/actions/driver'
import { LiveTrackingPanel } from '@/components/tracking/live-tracking-panel'
import { getDeliveryOtp } from '@/app/actions/delivery'
import {
  getMyRatingForDelivery,
  getRatingSummary,
  type Rating,
} from '@/app/actions/ratings'
import { RatingPrompt } from '@/components/shared/rating-prompt'
import { formatPrice } from '@/lib/pricing'

const OTP_VISIBLE_STATUSES = ['accepted', 'collected', 'in_transit']

const STATUS_ORDER = [
  'requested',
  'accepted',
  'collected',
  'in_transit',
  'delivered',
]

function formatLogTime(iso:string){return timelineTime(iso)}

type Driver = { full_name: string | null } | null

function driverInitials(d: Driver) {
  const n = d?.full_name?.trim()
  if (!n) return 'NA'
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> =
  {
    requested: {
      bg: 'bg-[#adaaaa]/10',
      text: 'text-[#adaaaa]',
      dot: 'bg-[#adaaaa]',
    },
    accepted: {
      bg: 'bg-[var(--color-primary)]/10',
      text: 'text-[var(--color-primary)]',
      dot: 'bg-[var(--color-primary)]',
    },
    collected: {
      bg: 'bg-[var(--color-secondary)]/10',
      text: 'text-[var(--color-secondary)]',
      dot: 'bg-[var(--color-secondary)]',
    },
    in_transit: {
      bg: 'bg-[#6ee7b7]/10',
      text: 'text-[#6ee7b7]',
      dot: 'bg-[#6ee7b7]',
    },
    delivered: {
      bg: 'bg-[#6ee7b7]/10',
      text: 'text-[#6ee7b7]',
      dot: 'bg-[#6ee7b7]',
    },
    cancelled: {
      bg: 'bg-[#ff6e84]/10',
      text: 'text-[#ff6e84]',
      dot: 'bg-[#ff6e84]',
    },
  }

function buildSteps(
  status: string,
  logs: { status: string; created_at: string;occurred_at_known?:boolean }[],
  createdAt: string,
) {
  const cur = STATUS_ORDER.indexOf(status.toLowerCase())
  const isDelivered = status === 'delivered'
  return STATUS_ORDER.map((st, i) => {
    const log = logs.find((l) => l.status === st)
    const timestamp = (log?.occurred_at_known===false?null:log?.created_at) ?? (st === 'requested' ? createdAt : null)
    return {
      label: st.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      detail: log?.occurred_at_known===false?'Time unavailable':timestamp ? formatLogTime(timestamp) : '',
      // When delivered, ALL steps are done (including the last one)
      done: isDelivered ? true : cur !== -1 && i < cur,
      active: isDelivered ? false : i === cur,
    }
  })
}

function TrackingPageInner() {
  const [centreRequest,setCentreRequest]=useState(0),[mapType,setMapType]=useState<'roadmap'|'satellite'>('roadmap')
  const [eta, setEta] = useState<{minutes:number;destination:boolean}|null>(null)
  const [loading, setLoading] = useState(true), [loadError,setLoadError]=useState(''), [revision,setRevision]=useState(0)
  const [showModal, setShowModal] = useState(false)
  const [shipment, setShipment] = useState<any>(null)
  const [driver, setDriver] = useState<Driver>(null)
  const [otp, setOtp] = useState<string | null>(null)
  const [steps, setSteps] = useState(
    STATUS_ORDER.map((s) => ({
      label: s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      detail: '',
      done: false,
      active: false,
    })),
  )
  const [myRating, setMyRating] = useState<Rating | null>(null)
  const [driverRating, setDriverRating] = useState<{
    average: number | null
    count: number
  }>({ average: null, count: 0 })
  const [userId, setUserId] = useState('')
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const requestedId = searchParams.get('id')

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setLoadError(''); setShipment(null); setDriver(null); setOtp(null); setMyRating(null); setEta(null)
      try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) throw new Error('Please sign in to view tracking.')
      setUserId(user.id)

      // Always select parcel_image_url so we can show it when delivered
      let q = supabase
        .from('delivery_requests')
        .select(
          'id,tracking_number,status,pickup_address,delivery_address,driver_id,created_at,pickup_lat,pickup_lng,delivery_lat,delivery_lng,parcel_image_url,delivered_image_url,item_description,item_photo_urls,price,base_price,surge_multiplier,discount_amount,promo_code,service_type,bfm_stage',
        )
        .eq('customer_id', user.id)

      if (requestedId) {
        // Specific order — show regardless of status (active OR delivered OR cancelled)
        q = q.eq('id', requestedId)
      } else {
        // No ID — prefer active, fallback to most recent delivered
        q = q
          .in('status', [
            'requested',
            'accepted',
            'collected',
            'in_transit',
            'delivered',
          ])
          .order('created_at', { ascending: false })
          .limit(1)
      }

      const { data, error } = await q.maybeSingle()
      if (cancelled) return
      if (error) throw error
      if (!data) {
        setShipment(null)
        setDriver(null)
        return
      }

      if (!cancelled) applyShipment(data)

      const { data: logs } = await supabase
        .from('delivery_status_logs')
        .select('status, created_at, occurred_at_known')
        .eq('delivery_id', data.id)
        .order('created_at', { ascending: true })
      if (!cancelled)
        setSteps(buildSteps(data.status, logs ?? [], data.created_at))

      if (data.driver_id) {
        const names = await getDriverNamesByIds([data.driver_id])
        if (!cancelled) setDriver({ full_name: names[data.driver_id] ?? 'Your driver' } as Driver)

        const summary = await getRatingSummary(data.driver_id)
        if (!cancelled) setDriverRating(summary)
      }

      const { data: code } = await getDeliveryOtp(data.id)
      if (!cancelled) setOtp(code)

      if (data.status === 'delivered') {
        const { data: rating } = await getMyRatingForDelivery(data.id)
        if (!cancelled) setMyRating(rating)
      }
      } catch { if (!cancelled) setLoadError('Could not load tracking. Please try again.') } finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [supabase, requestedId, revision])

  // Realtime plus a visible-page fallback if the socket is unavailable.
  useEffect(() => {
    if (!shipment?.id) return
    let alive=true,busy=false,version=0,knownDriver=shipment.driver_id,knownStatus=shipment.status
    const receive=async(updated:any)=>{
      const request=++version
      if(!alive||!updated)return
      setShipment((prev:any)=>prev?.id===updated.id?{...prev,...updated}:prev)
      const {data:logs,error}=await supabase.from('delivery_status_logs').select('status, created_at, occurred_at_known').eq('delivery_id',updated.id).order('created_at',{ascending:true})
      if(!alive||request!==version)return
      if(!error)setSteps(buildSteps(updated.status,logs??[],updated.created_at??shipment.created_at))
      if(updated.driver_id!==knownDriver){
        knownDriver=updated.driver_id;setDriver(null);setDriverRating({average:null,count:0});setEta(null)
        if(updated.driver_id){const [names,summary]=await Promise.all([getDriverNamesByIds([updated.driver_id]),getRatingSummary(updated.driver_id)]);if(!alive||request!==version)return;setDriver({full_name:names[updated.driver_id]??'Your driver'});setDriverRating(summary)}
      }
      if(updated.status==='delivered'&&knownStatus!=='delivered'){const {data:rating}=await getMyRatingForDelivery(updated.id);if(alive&&request===version)setMyRating(rating)}
      knownStatus=updated.status
    }
    const refresh=async()=>{if(busy||document.visibilityState!=='visible')return;busy=true;try{const {data,error}=await supabase.from('delivery_requests').select('id,tracking_number,status,pickup_address,delivery_address,driver_id,created_at,pickup_lat,pickup_lng,delivery_lat,delivery_lng,parcel_image_url,delivered_image_url,item_description,item_photo_urls,price,base_price,surge_multiplier,discount_amount,promo_code,service_type,bfm_stage').eq('id',shipment.id).eq('customer_id',userId).maybeSingle();if(alive){if(error)setLoadError('Tracking updates are delayed. Please try again.');else if(data){setLoadError('');await receive(data)}}}catch{if(alive)setLoadError('Tracking updates are delayed. Please try again.')}finally{busy=false}}
    const channel=supabase.channel(`tracking-delivery-${shipment.id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'delivery_requests',filter:`id=eq.${shipment.id}`},payload=>{void receive(payload.new).catch(()=>{if(alive)setLoadError('Could not refresh tracking details. Please try again.')})}).subscribe()
    const timer=setInterval(refresh,20000);window.addEventListener('focus',refresh)
    return()=>{alive=false;version++;clearInterval(timer);window.removeEventListener('focus',refresh);void supabase.removeChannel(channel)}
  },[supabase,shipment?.id,userId])

  function applyShipment(data: any) {
    setShipment(data)
  }

  const statusCfg = STATUS_COLORS[shipment?.status] ?? STATUS_COLORS.requested
  const isDelivered = shipment?.status === 'delivered'

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} userId={userId} />
      {loadError && <div role="alert" className="fixed top-24 left-4 right-4 z-50 bg-[#1b1d20] border border-red-400/40 rounded-xl p-4 text-white">{loadError} <button type="button" className="text-[var(--brand-soft)] underline" onClick={() => setRevision(v=>v+1)}>Try again</button></div>}

      <main
        className={`${navStyles.trackingContent} overflow-hidden flex flex-col md:flex-row`}
      >
        {/* ── Info Panel ─────────────────────────────────────────── */}
        <aside
          className="
          order-2 md:order-1
          md:w-[320px] md:flex-shrink-0
          flex-[5] md:flex-none md:h-full
          flex flex-col
          bg-[#0e0e0e] md:border-r border-[#494847]/20
          rounded-t-2xl md:rounded-none
          overflow-y-auto
          z-10
        "
        >
          {/* Drag handle — mobile only */}
          <div className="md:hidden flex justify-center pt-3 pb-2 shrink-0 sticky top-0 bg-[#0e0e0e] z-20">
            <div className="w-12 h-1 rounded-full bg-[#494847]/60" />
          </div>

          {/* ── Delivered banner ── */}
          {isDelivered && (
            <div className="mx-4 mt-3 mb-1 flex items-center gap-3 bg-[#6ee7b7]/10 border border-[#6ee7b7]/20 rounded-2xl px-4 py-3 shrink-0">
              <span
                className="material-symbols-outlined text-[#6ee7b7] text-2xl shrink-0"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              <div>
                <p className="text-sm font-bold text-[#6ee7b7]">
                  Delivery Complete!
                </p>
                <p className="text-[11px] text-[#adaaaa] mt-0.5">
                  Your parcel has been delivered successfully.
                </p>
              </div>
            </div>
          )}

          {/* ── Header: tracking number + status ── */}
          <div className="px-5 pt-3 pb-4 border-b border-[#494847]/20 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                {isDelivered ? 'Delivery Record' : 'Live Tracking'}
              </p>
              {shipment && (
                <span
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusCfg.bg} ${statusCfg.text} border-current/20`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${statusCfg.dot} ${shipment.status === 'in_transit' ? 'animate-pulse' : ''}`}
                  />
                  {shipment.status?.replace('_', ' ')}
                </span>
              )}
            </div>
            <p className="text-lg font-black font-headline text-white leading-tight">
              {shipment
                ? (shipment.tracking_number ??
                  `KV-${shipment.id.slice(0, 8).toUpperCase()}`)
                : loading ? 'Loading tracking…' : loadError ? 'Tracking unavailable' : 'No shipment found'}
            </p>
            {shipment && (
              <p className="text-xs text-[#adaaaa] mt-1 leading-relaxed">
                <span className="font-medium text-white/70">
                  {shipment.pickup_address}
                </span>
                <span className="mx-1.5 text-[var(--color-primary)]">→</span>
                <span className="font-medium text-white/70">
                  {shipment.delivery_address}
                </span>
              </p>
            )}
          </div>

          {/* ── Payment breakdown ── */}
          {shipment?.service_type !== 'buy_for_me' && shipment?.price != null && (
            <div className="mx-4 mt-3 rounded-2xl overflow-hidden border border-[#494847]/20 shrink-0 bg-[#1a1919]">
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#494847]/15">
                <span className="material-symbols-outlined text-[#6ee7b7] text-base">
                  payments
                </span>
                <p className="text-[11px] font-bold text-[#6ee7b7] uppercase tracking-wider">
                  Payment
                </p>
              </div>
              <div className="px-3 py-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#adaaaa]">Base fare</span>
                  <span className="text-white font-semibold">
                    £{formatPrice(shipment.base_price ?? shipment.price)}
                  </span>
                </div>
                {shipment.surge_multiplier > 1 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#fb923c]">Surge pricing</span>
                    <span className="text-[#fb923c] font-semibold">
                      {shipment.surge_multiplier}× applied
                    </span>
                  </div>
                )}
                {shipment.discount_amount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6ee7b7]">
                      Discount
                      {shipment.promo_code ? ` (${shipment.promo_code})` : ''}
                    </span>
                    <span className="text-[#6ee7b7] font-semibold">
                      −£{formatPrice(shipment.discount_amount)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-1.5 border-t border-[#494847]/15">
                  <span className="text-white font-bold">Total paid</span>
                  <span className="text-white font-black">
                    £{formatPrice(shipment.price)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {shipment?.service_type === 'buy_for_me' && <CustomerShoppingOrder key={shipment.id} orderId={shipment.id} />}

          {/* ── Rate your driver ── */}
          {isDelivered && shipment?.driver_id && (
            <div className="mx-4 mt-3 shrink-0">
              {myRating ? (
                <div className="rounded-2xl border border-[#494847]/15 bg-[#1a1919] px-4 py-3 flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-yellow-400 text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                  <div>
                    <p className="text-sm text-white">
                      You rated this delivery {myRating.score}/5
                    </p>
                    <p className="text-[10px] text-[#adaaaa] mt-0.5">
                      {myRating.status === 'pending'
                        ? 'Pending admin review'
                        : myRating.status === 'approved'
                          ? 'Published'
                          : 'Not published'}
                    </p>
                  </div>
                </div>
              ) : (
                <RatingPrompt
                  deliveryId={shipment.id}
                  ratedLabel="your driver"
                />
              )}
            </div>
          )}

          {/* ── Delivery code ── */}
          {otp &&
            shipment &&
            OTP_VISIBLE_STATUSES.includes(shipment.status) && (
              <div className="mx-4 mt-3 rounded-2xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 px-4 py-4 shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-primary)] mb-1.5">
                      Delivery Code
                    </p>
                    <p className="text-3xl font-black font-mono tracking-[0.3em] text-white">
                      {otp}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-[var(--color-primary)] text-2xl shrink-0">
                    lock
                  </span>
                </div>
                <p className="text-[11px] text-[#adaaaa] mt-2.5 leading-relaxed">
                  Share this code with your driver only when they arrive with
                  your package — they'll need it to confirm delivery.
                </p>
              </div>
            )}

          {/* ── ETA / Completion row ── */}
          {!isDelivered && (
            <div className="px-5 py-4 border-b border-[#494847]/20 shrink-0 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#adaaaa] mb-1">
                  {eta?.destination ? 'Estimated delivery' : 'Driver arrival'}
                </p>
                <p className="text-3xl font-black font-headline text-white tracking-tighter">
                  {eta ? `${eta.minutes} min` : '—'}
                </p>
                <p className="text-xs text-[#adaaaa]/60 mt-0.5">
                  {eta ? (eta.destination ? 'Estimated delivery · traffic may vary' : 'Driver reaches pickup · traffic may vary') : shipment?.driver_id ? 'Waiting for a current route estimate' : 'Awaiting driver'}
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-[var(--color-primary)] text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  schedule
                </span>
              </div>
            </div>
          )}

          {/* ── Item description + photos submitted at booking ── */}
          {(shipment?.item_description ||
            (shipment?.item_photo_urls &&
              shipment.item_photo_urls.length > 0)) && (
            <div className="mx-4 my-3 rounded-2xl overflow-hidden border border-[#494847]/20 shrink-0 bg-[#1a1919]">
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#494847]/15">
                <span className="material-symbols-outlined text-[var(--color-primary)] text-base">
                  inventory_2
                </span>
                <p className="text-[11px] font-bold text-[var(--color-primary)] uppercase tracking-wider">
                  Item Details
                </p>
              </div>
              <div className="px-3 py-3 space-y-2.5">
                {shipment?.item_description && (
                  <p className="text-sm text-white whitespace-pre-wrap">
                    {shipment.item_description}
                  </p>
                )}
                {shipment?.item_photo_urls &&
                  shipment.item_photo_urls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {shipment.item_photo_urls.map((url: string) => (
                        <a
                          key={url}
                          href={orderMediaUrl(url)}
                          target="_blank"
                          rel="noreferrer"
                          className="w-16 h-16 rounded-lg overflow-hidden border border-[#494847]/20 shrink-0"
                        >
                          <img
                            src={orderMediaUrl(url)}
                            alt="Item"
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          )}

          {shipment&&<OrderRecoveryInstructions id={shipment.id}/>}
          {/* ── Parcel photo (shown after collected + when delivered) ── */}
          {shipment?.parcel_image_url && (
            <div className="mx-4 my-3 rounded-2xl overflow-hidden border border-[#494847]/20 shrink-0">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-[#1a1919] border-b border-[#494847]/15">
                <span
                  className="material-symbols-outlined text-[#6ee7b7] text-base"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified
                </span>
                <p className="text-[11px] font-bold text-[#6ee7b7] uppercase tracking-wider">
                  Parcel Photo at Pickup
                </p>
              </div>
              <img
                src={`/api/delivery-proof?id=${encodeURIComponent(shipment.id)}&kind=pickup`}
                alt="Parcel at pickup"
                className="w-full object-cover"
                style={{ maxHeight: 180 }}
              />
            </div>
          )}

          {/* ── Proof-of-delivery photo (shown once delivered) ── */}
          {shipment?.delivered_image_url && (
            <div className="mx-4 my-3 rounded-2xl overflow-hidden border border-[#494847]/20 shrink-0">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-[#1a1919] border-b border-[#494847]/15">
                <span
                  className="material-symbols-outlined text-[#6ee7b7] text-base"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified
                </span>
                <p className="text-[11px] font-bold text-[#6ee7b7] uppercase tracking-wider">
                  Proof of Delivery
                </p>
              </div>
              <img
                src={`/api/delivery-proof?id=${encodeURIComponent(shipment.id)}&kind=delivery`}
                alt="Delivered package"
                className="w-full object-cover"
                style={{ maxHeight: 180 }}
              />
            </div>
          )}

          {/* ── Shipment Path Timeline ── */}
          <div className="md:flex-1 md:overflow-y-auto px-5 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#adaaaa]/70 mb-5">
              Shipment Path
            </p>
            <div className="space-y-0">
              {steps.map((step, i) => (
                <div key={step.label} className="flex gap-4 relative">
                  {i < steps.length - 1 && (
                    <div
                      className={`absolute left-[15px] top-8 bottom-0 w-px ${step.done ? 'bg-[#6ee7b7]/40' : 'bg-[#494847]/30'}`}
                    />
                  )}
                  <div
                    className={`relative z-10 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-all ${
                      step.done && !step.active
                        ? 'bg-[#6ee7b7] border-[#6ee7b7]'
                        : step.active
                          ? 'bg-[var(--color-primary)] border-[var(--color-primary)] shadow-[0_0_12px_rgba(var(--brand-rgb),0.45)]'
                          : 'bg-transparent border-[#494847]/30'
                    }`}
                  >
                    {step.done && !step.active && (
                      <span
                        className="material-symbols-outlined text-[#052e16] text-sm"
                        style={{
                          fontVariationSettings: "'FILL' 1, 'wght' 700",
                        }}
                      >
                        check
                      </span>
                    )}
                    {step.active && (
                      <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                    )}
                  </div>
                  <div className="pb-6 min-w-0">
                    <p
                      className={`text-sm font-bold leading-tight ${
                        step.done && !step.active
                          ? 'text-[#6ee7b7]'
                          : step.active
                            ? 'text-[var(--color-primary)]'
                            : 'text-[#494847]'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p
                      className={`text-xs mt-1 ${step.done || step.active ? 'text-[#adaaaa]' : 'text-[#494847]/60'}`}
                    >
                      {step.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Driver Card ── */}
          <div className="border-t border-[#494847]/20 px-5 py-4 md:shrink-0 bg-[#0e0e0e]">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center text-[var(--color-primary)] font-bold font-headline text-base shrink-0">
                {driverInitials(driver)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">
                  {driver?.full_name ||
                    (shipment?.driver_id
                      ? 'Driver assigned'
                      : 'Awaiting driver')}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className="material-symbols-outlined text-sm text-yellow-400"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                  <span className="text-sm font-bold text-white">
                    {driverRating.average != null
                      ? driverRating.average.toFixed(2)
                      : 'New'}
                  </span>
                  {driverRating.count > 0 && (
                    <span className="text-xs text-[#adaaaa] ml-1">
                      · {driverRating.count}{' '}
                      {driverRating.count === 1 ? 'rating' : 'ratings'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {shipment?.id && ['accepted','collected','in_transit'].includes(shipment.status) && <CustomerLocationBroadcaster key={shipment.id} deliveryId={shipment.id} orderLabel={shipment.tracking_number??shipment.id.slice(0,8)} />}
            {shipment?.id && <><CustomerThread kind="order" id={shipment.id} /><CollectionWaiting id={shipment.id}/></>}

          </div>
        </aside>

        {/* ── Map Area ─────────────────────────────────────── */}
        <div className="order-1 md:order-2 flex-[4] md:flex-1 md:h-full relative bg-[#131313]">
          {/* When delivered, just show static pickup→destination route — no live driver marker */}
          <LiveTrackingPanel
                onEta={setEta}
                centreRequest={centreRequest}
                mapType={mapType}
            status={shipment?.status}
            bfmStage={shipment?.bfm_stage}
            matchDeliveryId
            showViewerLocation={false}
            driverId={isDelivered || shipment?.status === 'cancelled' ? null : (shipment?.driver_id ?? null)}
            pickup={
              shipment?.pickup_lat != null && shipment?.pickup_lng != null
                ? {
                    lat: Number(shipment.pickup_lat),
                    lng: Number(shipment.pickup_lng),
                  }
                : null
            }
            destination={
              shipment?.delivery_lat != null && shipment?.delivery_lng != null
                ? {
                    lat: Number(shipment.delivery_lat),
                    lng: Number(shipment.delivery_lng),
                  }
                : null
            }
            customerId={null}
            deliveryId={shipment?.id ?? null}
            driverLabel={driver?.full_name ?? 'Driver'}
            height="100%"
            followDriver={false}
          />

          {/* Floating tracking chip */}
          {shipment && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <div className="flex items-center gap-2 bg-[#0e0e0e]/85 backdrop-blur-md border border-[#494847]/30 rounded-full px-4 py-2 shadow-lg">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${statusCfg.dot} ${shipment.status === 'in_transit' ? 'animate-pulse' : ''}`}
                />
                <span className="text-xs font-bold text-white font-mono">
                  {shipment.tracking_number ??
                    `KV-${shipment.id.slice(0, 8).toUpperCase()}`}
                </span>
                <span className="text-[10px] text-[#adaaaa] uppercase tracking-wider">
                  {shipment.status?.replace('_', ' ')}
                </span>
              </div>
            </div>
          )}

          {/* Map controls */}
          <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-2">
            <button
              className="w-11 h-11 bg-[#0e0e0e]/85 backdrop-blur-sm rounded-xl border border-[#494847]/30 flex items-center justify-center text-[#adaaaa] hover:text-white hover:bg-[#262626]/80 transition-all"
              title="Centre map"
              aria-label="Centre map"
              onClick={()=>setCentreRequest(n=>n+1)}
            >
              <span className="material-symbols-outlined text-xl">
                my_location
              </span>
            </button>
            <button
              className="w-11 h-11 bg-[#0e0e0e]/85 backdrop-blur-sm rounded-xl border border-[#494847]/30 flex items-center justify-center text-[#adaaaa] hover:text-white hover:bg-[#262626]/80 transition-all"
              title="Map layers"
              aria-label="Satellite map"
              aria-pressed={mapType==='satellite'}
              onClick={()=>setMapType(t=>t==='roadmap'?'satellite':'roadmap')}
            >
              <span className="material-symbols-outlined text-xl">layers</span>
            </button>
          </div>

          {/* No-shipment state */}
          {!shipment && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-[#0e0e0e]/85 backdrop-blur-md border border-[#494847]/20 rounded-2xl px-8 py-7 text-center">
                <span className="material-symbols-outlined text-5xl text-[#494847] block mb-3">
                  explore_off
                </span>
                <p className="text-white font-bold text-base">
                  {loading ? 'Loading tracking…' : loadError ? 'Tracking unavailable' : 'No shipment found'}
                </p>
                <p className="text-[#adaaaa] text-sm mt-1">
                  Check your delivery history for past orders
                </p>
              </div>
            </div>
          )}

          {/* Delivered overlay on map */}
          {isDelivered && (
            <div className="absolute bottom-6 left-4 z-10 pointer-events-none">
              <div className="flex items-center gap-2 bg-[#6ee7b7]/15 backdrop-blur-md border border-[#6ee7b7]/30 rounded-2xl px-4 py-3 shadow-lg">
                <span
                  className="material-symbols-outlined text-[#6ee7b7] text-xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
                <div>
                  <p className="text-xs font-bold text-[#6ee7b7]">Delivered</p>
                  <p className="text-[10px] text-[#adaaaa]">
                    Route shown above
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}

export default function LiveTrackingPage() {
  return (
    <Suspense fallback={null}>
      <TrackingPageInner />
    </Suspense>
  )
}
