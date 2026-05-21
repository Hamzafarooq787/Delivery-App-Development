'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'
import { LiveTrackingPanel } from '@/components/tracking/live-tracking-panel'
import { CustomerLocationBroadcaster } from '@/components/tracking/customer-location-broadcaster'

const STATUS_ORDER = ['requested', 'accepted', 'collected', 'in_transit', 'delivered']

const defaultSteps = STATUS_ORDER.map((s) => ({
  label: s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  detail: '—',
  done: false,
  active: false,
}))

type Driver = { full_name: string | null } | null

function driverInitials(d: Driver) {
  const n = d?.full_name?.trim()
  if (!n) return 'NA'
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  requested:  { bg: 'bg-[#adaaaa]/10', text: 'text-[#adaaaa]', dot: 'bg-[#adaaaa]' },
  accepted:   { bg: 'bg-[#a3a6ff]/10', text: 'text-[#a3a6ff]', dot: 'bg-[#a3a6ff]' },
  collected:  { bg: 'bg-[#a3a6ff]/10', text: 'text-[#a3a6ff]', dot: 'bg-[#a3a6ff]' },
  in_transit: { bg: 'bg-[#6ee7b7]/10', text: 'text-[#6ee7b7]', dot: 'bg-[#6ee7b7]' },
  delivered:  { bg: 'bg-[#a3a6ff]/10', text: 'text-[#a3a6ff]', dot: 'bg-[#a3a6ff]' },
}

function TrackingPageInner() {
  const [showModal, setShowModal] = useState(false)
  const [shipment, setShipment] = useState<any>(null)
  const [driver, setDriver] = useState<Driver>(null)
  const [steps, setSteps] = useState(defaultSteps)
  const [userId, setUserId] = useState('')
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const requestedId = searchParams.get('id')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      setUserId(user.id)

      let q = supabase
        .from('delivery_requests')
        .select('id,tracking_number,status,pickup_address,delivery_address,driver_id,created_at,pickup_lat,pickup_lng,delivery_lat,delivery_lng')
        .eq('customer_id', user.id)

      q = requestedId
        ? q.eq('id', requestedId)
        : q.in('status', ['requested', 'accepted', 'collected', 'in_transit']).order('created_at', { ascending: false }).limit(1)

      const { data, error } = await q.maybeSingle()
      if (cancelled || error) return
      if (!data) { setShipment(null); setDriver(null); setSteps(defaultSteps); return }

      setShipment(data)
      const cur = STATUS_ORDER.indexOf((data.status || 'requested').toLowerCase())
      setSteps(STATUS_ORDER.map((st, i) => ({
        label: st.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        detail: data.tracking_number || 'Live',
        done: cur !== -1 && i < cur,
        active: i === cur,
      })))

      if (data.driver_id) {
        const { data: drv } = await supabase.from('users').select('full_name').eq('id', data.driver_id).maybeSingle()
        if (!cancelled) setDriver(drv as Driver)
      } else {
        setDriver(null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase, requestedId])

  const statusCfg = STATUS_COLORS[shipment?.status] ?? STATUS_COLORS.requested

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} userId={userId} />

      {/*
        Layout:
        ┌──────────────────────────────────────┐
        │ Desktop: [Info Panel 300px] [Map]     │
        │ Mobile:  [Map flex-4] [Panel flex-5] │
        │ Mobile main: top-16 bottom-16 (clear │
        │ header + BottomNav both 64px)         │
        └──────────────────────────────────────┘
      */}
      <main className="fixed top-16 left-0 md:left-64 right-0 bottom-16 md:bottom-0 overflow-hidden flex flex-col md:flex-row">

        {/* ── Info Panel ─────────────────────────────────────
            Mobile: order-2 = appears at bottom
            Desktop: order-1 = solid left sidebar
        ─────────────────────────────────────────────────── */}
        <aside className={`
          order-2 md:order-1
          md:w-[300px] md:flex-shrink-0
          flex-[5] md:flex-none md:h-full
          flex flex-col
          bg-[#080e1a] md:border-r border-[#1a3a5c]/30
          rounded-t-2xl md:rounded-none
          overflow-hidden
          z-10
        `}>

          {/* Drag handle — mobile only */}
          <div className="md:hidden flex justify-center pt-2.5 pb-1 shrink-0">
            <div className="w-10 h-[3px] rounded-full bg-[#1e3a5f]" />
          </div>

          {/* ── Header: tracking number + status ── */}
          <div className="px-5 pt-3 md:pt-5 pb-4 border-b border-[#1a3a5c]/20 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#4a9fd4]">Live Tracking</p>
              {shipment && (
                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${statusCfg.bg} ${statusCfg.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} ${shipment.status === 'in_transit' ? 'animate-pulse' : ''}`} />
                  {shipment.status?.replace('_', ' ')}
                </span>
              )}
            </div>
            <p className="text-base font-black font-headline text-white leading-tight">
              {shipment?.tracking_number ?? 'No active shipment'}
            </p>
            {shipment && (
              <p className="text-[11px] text-[#4a9fd4]/60 mt-0.5 truncate">
                {shipment.pickup_address} → {shipment.delivery_address}
              </p>
            )}
          </div>

          {/* ── ETA ── */}
          <div className="px-5 py-4 border-b border-[#1a3a5c]/20 shrink-0 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#4a9fd4] mb-1">
                Estimated Arrival
              </p>
              <p className="text-3xl font-black font-headline text-white tracking-tighter">
                {shipment?.status === 'in_transit' ? 'LIVE' : '--:--'}
              </p>
              <p className="text-[11px] text-[#4a9fd4]/50 mt-0.5">
                {shipment?.status === 'in_transit' ? '8 min ahead of schedule' : 'Awaiting dispatch'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#1a3a5c]/30 flex items-center justify-center">
              <span
                className="material-symbols-outlined text-[#4a9fd4] text-xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                schedule
              </span>
            </div>
          </div>

          {/* ── Timeline — scrollable ── */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#4a9fd4]/60 mb-4">
              Shipment Path
            </p>
            <div className="space-y-0">
              {steps.map((step, i) => (
                <div key={step.label} className="flex gap-3.5 relative">
                  {/* Connector line */}
                  {i < steps.length - 1 && (
                    <div className={`absolute left-[13px] top-6 bottom-0 w-px ${step.done ? 'bg-[#2a6498]' : 'bg-[#1a3a5c]/30'}`} />
                  )}
                  {/* Step dot */}
                  <div className={`relative z-10 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center border-2 shrink-0 transition-all ${
                    step.active
                      ? 'bg-[#a3a6ff] border-[#a3a6ff] shadow-[0_0_10px_rgba(163,166,255,0.4)]'
                      : step.done
                      ? 'bg-[#1a3a5c] border-[#2a6498]'
                      : 'bg-transparent border-[#1a3a5c]/30'
                  }`}>
                    {step.done && (
                      <span className="material-symbols-outlined text-[#a3a6ff] text-[13px]">check</span>
                    )}
                    {step.active && (
                      <div className="w-2 h-2 rounded-full bg-white shadow-sm" />
                    )}
                  </div>
                  {/* Step label */}
                  <div className="pb-5">
                    <p className={`text-sm font-bold leading-tight ${
                      step.active ? 'text-[#a3a6ff]' : step.done ? 'text-white' : 'text-[#1e3a5f]'
                    }`}>
                      {step.label}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${step.active || step.done ? 'text-[#4a9fd4]/60' : 'text-[#1e3a5f]/50'}`}>
                      {step.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Driver Card — pinned to bottom of panel ── */}
          <div className="border-t border-[#1a3a5c]/20 px-5 py-4 shrink-0 bg-[#080e1a]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#1a3a5c]/40 border border-[#2a6498]/30 flex items-center justify-center text-[#a3a6ff] font-bold font-headline text-sm shrink-0">
                {driverInitials(driver)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {driver?.full_name || (shipment?.driver_id ? 'Driver assigned' : 'Awaiting driver')}
                </p>
                <div className="flex items-center gap-1">
                  <span
                    className="material-symbols-outlined text-xs text-yellow-400"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                  <span className="text-xs font-bold text-white">4.92</span>
                  <span className="text-[10px] text-[#4a9fd4]/50 ml-1">· 1.2k Jobs</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="bg-[#1a3a5c]/30 hover:bg-[#1a3a5c]/50 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors border border-[#2a6498]/20">
                <span className="material-symbols-outlined text-sm text-[#4a9fd4]">mail</span>
                Message
              </button>
              <button className="bg-[#a3a6ff] hover:brightness-110 text-[#0f00a4] text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-[#a3a6ff]/20">
                <span className="material-symbols-outlined text-sm">call</span>
                Call
              </button>
            </div>
          </div>
        </aside>

        {/* ── Map Area ─────────────────────────────────────── */}
        <div className="order-1 md:order-2 flex-[4] md:flex-1 md:h-full relative bg-[#0a1628]">
          <LiveTrackingPanel
            driverId={shipment?.driver_id ?? null}
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
            customerId={userId || null}
            deliveryId={shipment?.id ?? null}
            driverLabel={driver?.full_name ?? 'Driver'}
            height="100%"
            followDriver={false}
          />

          {/* CustomerLocationBroadcaster — invisible, just broadcasts */}
          {shipment && ['accepted', 'collected', 'in_transit'].includes(shipment.status) && (
            <div className="hidden">
              <CustomerLocationBroadcaster deliveryId={shipment.id} />
            </div>
          )}

          {/* Floating tracking chip — top centre of map */}
          {shipment && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <div className="flex items-center gap-2 bg-[#080e1a]/80 backdrop-blur-md border border-[#1a3a5c]/40 rounded-full px-4 py-1.5 shadow-lg">
                <span className={`w-2 h-2 rounded-full ${statusCfg.dot} ${shipment.status === 'in_transit' ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-bold text-white font-mono">{shipment.tracking_number}</span>
                <span className="text-[10px] text-[#4a9fd4] uppercase tracking-wider">{shipment.status?.replace('_', ' ')}</span>
              </div>
            </div>
          )}

          {/* Map controls — floating bottom-right */}
          <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-2">
            <button
              className="w-10 h-10 bg-[#080e1a]/85 backdrop-blur-sm rounded-xl border border-[#1a3a5c]/40 flex items-center justify-center text-[#4a9fd4] hover:text-white hover:bg-[#1a3a5c]/60 transition-all"
              title="Centre map"
            >
              <span className="material-symbols-outlined text-lg">my_location</span>
            </button>
            <button
              className="w-10 h-10 bg-[#080e1a]/85 backdrop-blur-sm rounded-xl border border-[#1a3a5c]/40 flex items-center justify-center text-[#4a9fd4] hover:text-white hover:bg-[#1a3a5c]/60 transition-all"
              title="Map layers"
            >
              <span className="material-symbols-outlined text-lg">layers</span>
            </button>
          </div>

          {/* No-shipment state */}
          {!shipment && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-[#080e1a]/80 backdrop-blur-md border border-[#1a3a5c]/30 rounded-2xl px-8 py-6 text-center">
                <span className="material-symbols-outlined text-4xl text-[#1e3a5f] block mb-3">explore_off</span>
                <p className="text-white font-bold text-sm">No active shipment</p>
                <p className="text-[#4a9fd4]/60 text-xs mt-1">Your deliveries will appear here</p>
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
