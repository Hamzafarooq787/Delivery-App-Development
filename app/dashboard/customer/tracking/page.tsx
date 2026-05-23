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
  requested:  { bg: 'bg-[#adaaaa]/10', text: 'text-[#adaaaa]',  dot: 'bg-[#adaaaa]'  },
  accepted:   { bg: 'bg-[#a3a6ff]/10', text: 'text-[#a3a6ff]',  dot: 'bg-[#a3a6ff]'  },
  collected:  { bg: 'bg-[#c180ff]/10', text: 'text-[#c180ff]',  dot: 'bg-[#c180ff]'  },
  in_transit: { bg: 'bg-[#6ee7b7]/10', text: 'text-[#6ee7b7]',  dot: 'bg-[#6ee7b7]'  },
  delivered:  { bg: 'bg-[#6ee7b7]/10', text: 'text-[#6ee7b7]',  dot: 'bg-[#6ee7b7]'  },
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
        detail: data.tracking_number || `KV-${data.id.slice(0, 8).toUpperCase()}`,
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

          {/* ── Header: tracking number + status ── */}
          <div className="px-5 pt-2 md:pt-5 pb-4 border-b border-[#494847]/20 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3a6ff]">Live Tracking</p>
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
                : 'No active shipment'}
            </p>
            {shipment && (
              <p className="text-xs text-[#adaaaa] mt-1 leading-relaxed">
                <span className="font-medium text-white/70">{shipment.pickup_address}</span>
                <span className="mx-1.5 text-[#a3a6ff]">→</span>
                <span className="font-medium text-white/70">{shipment.delivery_address}</span>
              </p>
            )}
          </div>

          {/* ── ETA ── */}
          <div className="px-5 py-4 border-b border-[#494847]/20 shrink-0 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#adaaaa] mb-1">
                Estimated Arrival
              </p>
              <p className="text-3xl font-black font-headline text-white tracking-tighter">
                {shipment?.status === 'in_transit' ? 'LIVE' : '--:--'}
              </p>
              <p className="text-xs text-[#adaaaa]/60 mt-0.5">
                {shipment?.status === 'in_transit' ? 'Driver en route' : 'Awaiting dispatch'}
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-[#a3a6ff] text-2xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                schedule
              </span>
            </div>
          </div>

          {/* ── Shipment Path Timeline ── */}
          <div className="md:flex-1 md:overflow-y-auto px-5 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#adaaaa]/70 mb-5">
              Shipment Path
            </p>
            <div className="space-y-0">
              {steps.map((step, i) => (
                <div key={step.label} className="flex gap-4 relative">
                  {/* Connector line */}
                  {i < steps.length - 1 && (
                    <div className={`absolute left-[15px] top-8 bottom-0 w-px ${step.done ? 'bg-[#a3a6ff]/40' : 'bg-[#494847]/30'}`} />
                  )}
                  {/* Step dot */}
                  <div className={`relative z-10 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-all ${
                    step.active
                      ? 'bg-[#a3a6ff] border-[#a3a6ff] shadow-[0_0_12px_rgba(163,166,255,0.45)]'
                      : step.done
                      ? 'bg-[#262626] border-[#a3a6ff]/50'
                      : 'bg-transparent border-[#494847]/30'
                  }`}>
                    {step.done && (
                      <span className="material-symbols-outlined text-[#a3a6ff] text-sm">check</span>
                    )}
                    {step.active && (
                      <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                    )}
                  </div>
                  {/* Step label */}
                  <div className="pb-6 min-w-0">
                    <p className={`text-sm font-bold leading-tight ${
                      step.active ? 'text-[#a3a6ff]' : step.done ? 'text-white' : 'text-[#494847]'
                    }`}>
                      {step.label}
                    </p>
                    <p className={`text-xs mt-1 ${
                      step.active || step.done ? 'text-[#adaaaa]' : 'text-[#494847]/60'
                    }`}>
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
                  <span
                    className="material-symbols-outlined text-sm text-yellow-400"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                  <span className="text-sm font-bold text-white">4.92</span>
                  <span className="text-xs text-[#adaaaa] ml-1">· 1.2k Jobs</span>
                </div>
              </div>
            </div>
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
          </div>

        </aside>

        {/* ── Map Area ─────────────────────────────────────── */}
        <div className="order-1 md:order-2 flex-[4] md:flex-1 md:h-full relative bg-[#131313]">
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

          {/* CustomerLocationBroadcaster — invisible */}
          {shipment && ['accepted', 'collected', 'in_transit'].includes(shipment.status) && (
            <div className="hidden">
              <CustomerLocationBroadcaster deliveryId={shipment.id} />
            </div>
          )}

          {/* Floating tracking chip — top centre of map */}
          {shipment && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <div className="flex items-center gap-2 bg-[#0e0e0e]/85 backdrop-blur-md border border-[#494847]/30 rounded-full px-4 py-2 shadow-lg">
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusCfg.dot} ${shipment.status === 'in_transit' ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-bold text-white font-mono">{shipment.tracking_number ?? `KV-${shipment.id.slice(0, 8).toUpperCase()}`}</span>
                <span className="text-[10px] text-[#adaaaa] uppercase tracking-wider">{shipment.status?.replace('_', ' ')}</span>
              </div>
            </div>
          )}

          {/* Map controls — floating bottom-right */}
          <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-2">
            <button
              className="w-11 h-11 bg-[#0e0e0e]/85 backdrop-blur-sm rounded-xl border border-[#494847]/30 flex items-center justify-center text-[#adaaaa] hover:text-white hover:bg-[#262626]/80 transition-all"
              title="Centre map"
            >
              <span className="material-symbols-outlined text-xl">my_location</span>
            </button>
            <button
              className="w-11 h-11 bg-[#0e0e0e]/85 backdrop-blur-sm rounded-xl border border-[#494847]/30 flex items-center justify-center text-[#adaaaa] hover:text-white hover:bg-[#262626]/80 transition-all"
              title="Map layers"
            >
              <span className="material-symbols-outlined text-xl">layers</span>
            </button>
          </div>

          {/* No-shipment state */}
          {!shipment && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-[#0e0e0e]/85 backdrop-blur-md border border-[#494847]/20 rounded-2xl px-8 py-7 text-center">
                <span className="material-symbols-outlined text-5xl text-[#494847] block mb-3">explore_off</span>
                <p className="text-white font-bold text-base">No active shipment</p>
                <p className="text-[#adaaaa] text-sm mt-1">Your deliveries will appear here</p>
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
