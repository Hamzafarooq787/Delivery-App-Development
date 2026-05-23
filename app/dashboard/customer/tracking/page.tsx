'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'
import { LiveTrackingPanel } from '@/components/tracking/live-tracking-panel'

const STATUS_ORDER = ['requested', 'accepted', 'collected', 'in_transit', 'delivered']

type Driver = { full_name: string | null } | null

function driverInitials(d: Driver) {
  const n = d?.full_name?.trim()
  if (!n) return 'NA'
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  requested:  { bg: 'bg-[#adaaaa]/10', text: 'text-[#adaaaa]',  dot: 'bg-[#adaaaa]'  },
  accepted:   { bg: 'bg-[#a3a6ff]/10', text: 'text-[#a3a6ff]',  dot: 'bg-[#a3a6ff]'  },
  collected:  { bg: 'bg-[#c180ff]/10', text: 'text-[#c180ff]',  dot: 'bg-[#c180ff]'  },
  in_transit: { bg: 'bg-[#6ee7b7]/10', text: 'text-[#6ee7b7]',  dot: 'bg-[#6ee7b7]'  },
  delivered:  { bg: 'bg-[#6ee7b7]/10', text: 'text-[#6ee7b7]',  dot: 'bg-[#6ee7b7]'  },
  cancelled:  { bg: 'bg-[#ff6e84]/10', text: 'text-[#ff6e84]',  dot: 'bg-[#ff6e84]'  },
}

function buildSteps(status: string, tracking: string) {
  const cur = STATUS_ORDER.indexOf(status.toLowerCase())
  const isDelivered = status === 'delivered'
  return STATUS_ORDER.map((st, i) => ({
    label: st.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    detail: tracking,
    // When delivered, ALL steps are done (including the last one)
    done:   isDelivered ? true : (cur !== -1 && i < cur),
    active: isDelivered ? false : i === cur,
  }))
}

function TrackingPageInner() {
  const [showModal, setShowModal]   = useState(false)
  const [shipment,  setShipment]    = useState<any>(null)
  const [driver,    setDriver]      = useState<Driver>(null)
  const [steps,     setSteps]       = useState(STATUS_ORDER.map((s) => ({
    label: s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    detail: '—', done: false, active: false,
  })))
  const [userId,    setUserId]      = useState('')
  const supabase    = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const requestedId  = searchParams.get('id')

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      setUserId(user.id)

      // Always select parcel_image_url so we can show it when delivered
      let q = supabase
        .from('delivery_requests')
        .select('id,tracking_number,status,pickup_address,delivery_address,driver_id,created_at,pickup_lat,pickup_lng,delivery_lat,delivery_lng,parcel_image_url')
        .eq('customer_id', user.id)

      if (requestedId) {
        // Specific order — show regardless of status (active OR delivered OR cancelled)
        q = q.eq('id', requestedId)
      } else {
        // No ID — prefer active, fallback to most recent delivered
        q = q
          .in('status', ['requested', 'accepted', 'collected', 'in_transit', 'delivered'])
          .order('created_at', { ascending: false })
          .limit(1)
      }

      const { data, error } = await q.maybeSingle()
      if (cancelled || error) return
      if (!data) { setShipment(null); setDriver(null); return }

      applyShipment(data)

      if (data.driver_id) {
        const { data: drv } = await supabase.from('users').select('full_name').eq('id', data.driver_id).maybeSingle()
        if (!cancelled) setDriver(drv as Driver)
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase, requestedId])

  // ── Realtime: watch delivery_requests for live status updates ───────────────
  useEffect(() => {
    if (!shipment?.id) return

    const channel = supabase
      .channel(`tracking-delivery-${shipment.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'delivery_requests',
        filter: `id=eq.${shipment.id}`,
      }, async (payload) => {
        const updated = payload.new as any
        if (!updated) return

        // Merge new fields into shipment state
        setShipment((prev: any) => ({ ...prev, ...updated }))
        setSteps(buildSteps(
          updated.status,
          updated.tracking_number || `KV-${updated.id.slice(0, 8).toUpperCase()}`,
        ))

        // If driver changed (e.g. reassigned), re-fetch driver name
        if (updated.driver_id && updated.driver_id !== shipment.driver_id) {
          const { data: drv } = await supabase
            .from('users').select('full_name').eq('id', updated.driver_id).maybeSingle()
          setDriver(drv as Driver)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, shipment?.id])

  function applyShipment(data: any) {
    setShipment(data)
    setSteps(buildSteps(
      data.status,
      data.tracking_number || `KV-${data.id.slice(0, 8).toUpperCase()}`,
    ))
  }

  const statusCfg  = STATUS_COLORS[shipment?.status] ?? STATUS_COLORS.requested
  const isDelivered = shipment?.status === 'delivered'

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} userId={userId} />

      <main className="fixed top-16 left-0 md:left-64 right-0 bottom-16 md:bottom-0 overflow-hidden flex flex-col md:flex-row">

        {/* ── Info Panel ─────────────────────────────────────────── */}
        <aside className="
          order-2 md:order-1
          md:w-[320px] md:flex-shrink-0
          flex-[5] md:flex-none md:h-full
          flex flex-col
          bg-[#0e0e0e] md:border-r border-[#494847]/20
          rounded-t-2xl md:rounded-none
          overflow-y-auto md:overflow-hidden
          z-10
        ">
          {/* Drag handle — mobile only */}
          <div className="md:hidden flex justify-center pt-3 pb-2 shrink-0 sticky top-0 bg-[#0e0e0e] z-20">
            <div className="w-12 h-1 rounded-full bg-[#494847]/60" />
          </div>

          {/* ── Delivered banner ── */}
          {isDelivered && (
            <div className="mx-4 mt-3 mb-1 flex items-center gap-3 bg-[#6ee7b7]/10 border border-[#6ee7b7]/20 rounded-2xl px-4 py-3 shrink-0">
              <span className="material-symbols-outlined text-[#6ee7b7] text-2xl shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
              <div>
                <p className="text-sm font-bold text-[#6ee7b7]">Delivery Complete!</p>
                <p className="text-[11px] text-[#adaaaa] mt-0.5">Your parcel has been delivered successfully.</p>
              </div>
            </div>
          )}

          {/* ── Header: tracking number + status ── */}
          <div className="px-5 pt-3 pb-4 border-b border-[#494847]/20 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3a6ff]">
                {isDelivered ? 'Delivery Record' : 'Live Tracking'}
              </p>
              {shipment && (
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusCfg.bg} ${statusCfg.text} border-current/20`}>
                  <span className={`w-2 h-2 rounded-full ${statusCfg.dot} ${shipment.status === 'in_transit' ? 'animate-pulse' : ''}`} />
                  {shipment.status?.replace('_', ' ')}
                </span>
              )}
            </div>
            <p className="text-lg font-black font-headline text-white leading-tight">
              {shipment
                ? (shipment.tracking_number ?? `KV-${shipment.id.slice(0, 8).toUpperCase()}`)
                : 'No shipment found'}
            </p>
            {shipment && (
              <p className="text-xs text-[#adaaaa] mt-1 leading-relaxed">
                <span className="font-medium text-white/70">{shipment.pickup_address}</span>
                <span className="mx-1.5 text-[#a3a6ff]">→</span>
                <span className="font-medium text-white/70">{shipment.delivery_address}</span>
              </p>
            )}
          </div>

          {/* ── ETA / Completion row ── */}
          {!isDelivered && (
            <div className="px-5 py-4 border-b border-[#494847]/20 shrink-0 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#adaaaa] mb-1">Estimated Arrival</p>
                <p className="text-3xl font-black font-headline text-white tracking-tighter">
                  {shipment?.status === 'in_transit' ? 'LIVE' : '--:--'}
                </p>
                <p className="text-xs text-[#adaaaa]/60 mt-0.5">
                  {shipment?.status === 'in_transit' ? 'Driver en route' : 'Awaiting dispatch'}
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#a3a6ff] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
              </div>
            </div>
          )}

          {/* ── Parcel photo (shown after collected + when delivered) ── */}
          {shipment?.parcel_image_url && (
            <div className="mx-4 my-3 rounded-2xl overflow-hidden border border-[#494847]/20 shrink-0">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-[#1a1919] border-b border-[#494847]/15">
                <span className="material-symbols-outlined text-[#6ee7b7] text-base" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                <p className="text-[11px] font-bold text-[#6ee7b7] uppercase tracking-wider">Parcel Photo at Pickup</p>
              </div>
              <img
                src={shipment.parcel_image_url}
                alt="Parcel at pickup"
                className="w-full object-cover"
                style={{ maxHeight: 180 }}
              />
            </div>
          )}

          {/* ── Shipment Path Timeline ── */}
          <div className="md:flex-1 md:overflow-y-auto px-5 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#adaaaa]/70 mb-5">Shipment Path</p>
            <div className="space-y-0">
              {steps.map((step, i) => (
                <div key={step.label} className="flex gap-4 relative">
                  {i < steps.length - 1 && (
                    <div className={`absolute left-[15px] top-8 bottom-0 w-px ${step.done ? 'bg-[#6ee7b7]/40' : 'bg-[#494847]/30'}`} />
                  )}
                  <div className={`relative z-10 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-all ${
                    step.done && !step.active
                      ? 'bg-[#6ee7b7] border-[#6ee7b7]'
                      : step.active
                      ? 'bg-[#a3a6ff] border-[#a3a6ff] shadow-[0_0_12px_rgba(163,166,255,0.45)]'
                      : 'bg-transparent border-[#494847]/30'
                  }`}>
                    {step.done && !step.active && (
                      <span className="material-symbols-outlined text-[#052e16] text-sm" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>check</span>
                    )}
                    {step.active && (
                      <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                    )}
                  </div>
                  <div className="pb-6 min-w-0">
                    <p className={`text-sm font-bold leading-tight ${
                      step.done && !step.active ? 'text-[#6ee7b7]' : step.active ? 'text-[#a3a6ff]' : 'text-[#494847]'
                    }`}>
                      {step.label}
                    </p>
                    <p className={`text-xs mt-1 ${step.done || step.active ? 'text-[#adaaaa]' : 'text-[#494847]/60'}`}>
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
              <div className="w-12 h-12 rounded-full bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center text-[#a3a6ff] font-bold font-headline text-base shrink-0">
                {driverInitials(driver)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">
                  {driver?.full_name || (shipment?.driver_id ? 'Driver assigned' : 'Awaiting driver')}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-sm text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  <span className="text-sm font-bold text-white">4.92</span>
                  <span className="text-xs text-[#adaaaa] ml-1">· 1.2k Jobs</span>
                </div>
              </div>
            </div>
            {!isDelivered && (
              <div className="grid grid-cols-2 gap-3">
                <button className="bg-[#262626] hover:bg-[#303030] text-white text-sm font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors border border-[#494847]/20 active:scale-95">
                  <span className="material-symbols-outlined text-base text-[#adaaaa]">mail</span>
                  Message
                </button>
                <button className="bg-[#a3a6ff] hover:brightness-110 text-[#0f00a4] text-sm font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-[#a3a6ff]/20">
                  <span className="material-symbols-outlined text-base">call</span>
                  Call
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ── Map Area ─────────────────────────────────────── */}
        <div className="order-1 md:order-2 flex-[4] md:flex-1 md:h-full relative bg-[#131313]">
          {/* When delivered, just show static pickup→destination route — no live driver marker */}
          <LiveTrackingPanel
            driverId={isDelivered ? null : (shipment?.driver_id ?? null)}
            pickup={
              shipment?.pickup_lat != null && shipment?.pickup_lng != null
                ? { lat: Number(shipment.pickup_lat), lng: Number(shipment.pickup_lng) }
                : null
            }
            destination={
              shipment?.delivery_lat != null && shipment?.delivery_lng != null
                ? { lat: Number(shipment.delivery_lat), lng: Number(shipment.delivery_lng) }
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
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusCfg.dot} ${shipment.status === 'in_transit' ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-bold text-white font-mono">
                  {shipment.tracking_number ?? `KV-${shipment.id.slice(0, 8).toUpperCase()}`}
                </span>
                <span className="text-[10px] text-[#adaaaa] uppercase tracking-wider">
                  {shipment.status?.replace('_', ' ')}
                </span>
              </div>
            </div>
          )}

          {/* Map controls */}
          <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-2">
            <button className="w-11 h-11 bg-[#0e0e0e]/85 backdrop-blur-sm rounded-xl border border-[#494847]/30 flex items-center justify-center text-[#adaaaa] hover:text-white hover:bg-[#262626]/80 transition-all" title="Centre map">
              <span className="material-symbols-outlined text-xl">my_location</span>
            </button>
            <button className="w-11 h-11 bg-[#0e0e0e]/85 backdrop-blur-sm rounded-xl border border-[#494847]/30 flex items-center justify-center text-[#adaaaa] hover:text-white hover:bg-[#262626]/80 transition-all" title="Map layers">
              <span className="material-symbols-outlined text-xl">layers</span>
            </button>
          </div>

          {/* No-shipment state */}
          {!shipment && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-[#0e0e0e]/85 backdrop-blur-md border border-[#494847]/20 rounded-2xl px-8 py-7 text-center">
                <span className="material-symbols-outlined text-5xl text-[#494847] block mb-3">explore_off</span>
                <p className="text-white font-bold text-base">No shipment found</p>
                <p className="text-[#adaaaa] text-sm mt-1">Check your delivery history for past orders</p>
              </div>
            </div>
          )}

          {/* Delivered overlay on map */}
          {isDelivered && (
            <div className="absolute bottom-6 left-4 z-10 pointer-events-none">
              <div className="flex items-center gap-2 bg-[#6ee7b7]/15 backdrop-blur-md border border-[#6ee7b7]/30 rounded-2xl px-4 py-3 shadow-lg">
                <span className="material-symbols-outlined text-[#6ee7b7] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <div>
                  <p className="text-xs font-bold text-[#6ee7b7]">Delivered</p>
                  <p className="text-[10px] text-[#adaaaa]">Route shown above</p>
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
