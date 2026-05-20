'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'
import { LiveTrackingPanel } from '@/components/tracking/live-tracking-panel'
import { CustomerLocationBroadcaster } from '@/components/tracking/customer-location-broadcaster'

const defaultTimelineSteps = [
  { label: 'Requested', detail: '—', done: false, active: false },
  { label: 'Accepted', detail: '—', done: false, active: false },
  { label: 'Collected', detail: '—', done: false, active: false },
  { label: 'In Transit', detail: '—', done: false, active: false },
  { label: 'Delivered', detail: '—', done: false, active: false },
]

type Driver = { full_name: string | null } | null

function LiveTrackingPageInner() {
  const [showModal, setShowModal] = useState(false)
  const [shipment, setShipment] = useState<any>(null)
  const [driver, setDriver] = useState<Driver>(null)
  const [timelineSteps, setTimelineSteps] = useState(defaultTimelineSteps)
  const [userId, setUserId] = useState('')
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const requestedId = searchParams.get('id')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      if (!cancelled) setUserId(user.id)

      let query = supabase
        .from('delivery_requests')
        .select('id,tracking_number,status,pickup_address,delivery_address,driver_id,created_at,pickup_lat,pickup_lng,delivery_lat,delivery_lng')
        .eq('customer_id', user.id)

      if (requestedId) {
        query = query.eq('id', requestedId)
      } else {
        query = query
          .in('status', ['requested', 'accepted', 'collected', 'in_transit'])
          .order('created_at', { ascending: false })
          .limit(1)
      }

      const { data, error } = await query.maybeSingle()
      if (cancelled) return
      if (error) { console.error('[v0] tracking fetch error', error); return }
      if (!data) {
        setShipment(null)
        setDriver(null)
        setTimelineSteps(defaultTimelineSteps)
        return
      }
      setShipment(data)

      const steps = ['requested', 'accepted', 'collected', 'in_transit', 'delivered']
      const current = steps.indexOf((data.status || 'requested').toLowerCase())
      setTimelineSteps(steps.map((st, idx) => ({
        label: st.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        detail: data.tracking_number || 'Live',
        done: current === -1 ? false : idx < current,
        active: idx === current,
      })))

      if (data.driver_id) {
        const { data: drv, error: drvErr } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', data.driver_id)
          .maybeSingle()
        if (cancelled) return
        if (drvErr) { console.error('[v0] driver fetch error', drvErr); return }
        setDriver(drv as Driver)
      } else {
        setDriver(null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase, requestedId])

  function driverInitials(d: Driver) {
    const n = d?.full_name?.trim()
    if (!n) return 'NA'
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} userId={userId} />
      <main className="pt-16 pb-28 md:pb-0 md:ml-64 min-h-screen bg-surface-container-low relative overflow-hidden">
        {/* Live Map Background */}
        <div className="absolute inset-0 z-0">
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
          {shipment && ['accepted', 'collected', 'in_transit'].includes(shipment.status) && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
              <CustomerLocationBroadcaster deliveryId={shipment.id} />
            </div>
          )}
        </div>

        {/* Overlay Panels Container */}
        <div className="relative z-10 p-4 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 h-[calc(100vh-4rem)] overflow-y-auto md:overflow-visible">
          {/* Left Panel: Tracking Info */}
          <div className="md:col-span-4 lg:col-span-3 space-y-4">
            {/* ETA Card */}
            <div className="glass-card rounded-xl p-6 glow-primary border border-outline-variant/15">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs font-bold text-primary tracking-[0.2em] uppercase mb-1">
                    Estimated Arrival
                  </p>
                  <h2 className="text-4xl font-extrabold font-headline text-on-surface tracking-tighter">
                    {shipment?.status === "in_transit" ? "LIVE" : "--:--"}
                  </h2>
                </div>
                <div className="bg-primary/10 p-2 rounded-lg">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    schedule
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                <span>8 mins ahead of schedule</span>
              </div>
            </div>

            {/* Tracking Timeline */}
            <div className="glass-card rounded-xl p-6 border border-outline-variant/15">
              <h3 className="text-sm font-bold text-on-surface mb-6 uppercase tracking-widest">
                Shipment Path
              </h3>
              <div className="relative space-y-8">
                <div className="absolute left-3.5 top-2 bottom-2 w-px border-l border-dashed border-outline-variant" />
                {timelineSteps.map((step) => (
                  <div key={step.label} className={`relative flex items-start space-x-4 ${!step.done && !step.active ? 'opacity-40' : ''}`}>
                    <div
                      className={`z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 ${
                        step.active
                          ? 'bg-surface-container-highest border-primary'
                          : 'bg-surface-container-highest border-outline-variant'
                      }`}
                    >
                      {step.done && (
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
                          check
                        </span>
                      )}
                      {step.active && (
                        <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(193,128,255,0.6)]" />
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${step.active ? 'text-primary' : 'text-on-surface'}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-on-surface-variant">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Driver Info */}
            <div className="glass-card rounded-xl p-4 border border-outline-variant/15">
              <div className="flex items-center space-x-4 mb-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold font-headline text-lg">
                    {driverInitials(driver)}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-surface rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-[10px] text-white">verified</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-on-surface">{driver?.full_name || (shipment?.driver_id ? 'Driver assigned' : 'Awaiting driver')}</h4>
                  <div className="flex items-center space-x-1">
                    <span
                      className="material-symbols-outlined text-xs text-tertiary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      star
                    </span>
                    <span className="text-xs font-bold text-on-surface">4.92</span>
                    <span className="text-[10px] text-on-surface-variant uppercase tracking-tighter ml-1">
                      • 1.2k Jobs
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button className="bg-surface-container-highest hover:bg-surface-container-high text-on-surface text-xs font-bold py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors border border-outline-variant/20">
                  <span className="material-symbols-outlined text-sm">mail</span>
                  <span>Message</span>
                </button>
                <button className="bg-primary hover:brightness-110 text-on-primary text-xs font-bold py-2 rounded-lg flex items-center justify-center space-x-2 transition-transform active:scale-95 shadow-lg shadow-primary/20">
                  <span className="material-symbols-outlined text-sm">call</span>
                  <span>Call</span>
                </button>
              </div>
            </div>
          </div>

          {/* Center & Right: Floating Interaction Areas */}
          <div className="md:col-span-8 lg:col-span-9 relative flex flex-col justify-end">
            {/* Floating Stats */}
            <div className="flex flex-wrap gap-4 mb-6">
              {[
                { icon: 'speed', color: 'text-primary', label: 'Avg. Speed', value: '64 km/h' },
                { icon: 'package_2', color: 'text-secondary', label: 'Parcel Load', value: 'Fragile Tier 1' },
                { icon: 'thermostat', color: 'text-tertiary', label: 'Cargo Temp', value: '4.2°C' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="glass-card px-4 py-3 rounded-full border border-outline-variant/15 flex items-center space-x-3"
                >
                  <span className={`material-symbols-outlined ${stat.color}`}>{stat.icon}</span>
                  <div className="text-xs">
                    <p className="text-on-surface-variant font-medium">{stat.label}</p>
                    <p className="text-on-surface font-bold">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Shipment Control Bar */}
            <div className="glass-card w-full p-4 rounded-2xl border border-outline-variant/20 flex items-center justify-between mb-4 md:mb-0">
              <div className="flex items-center space-x-6 px-4">
                <div className="hidden sm:block">
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">
                    Shipment ID
                  </p>
                  <p className="text-sm font-headline font-black text-on-surface">{shipment?.tracking_number || "—"}</p>
                </div>
                <div className="h-8 w-px bg-outline-variant/30 hidden sm:block" />
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">
                    Current Sector
                  </p>
                  <p className="text-sm font-headline font-bold text-on-surface">{shipment?.delivery_address || "—"}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-3 rounded-xl bg-surface-container-highest text-on-surface hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined">layers</span>
                </button>
                <button className="p-3 rounded-xl bg-surface-container-highest text-on-surface hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined">center_focus_strong</span>
                </button>
                <button className="ml-4 px-6 py-3 rounded-xl bg-secondary text-on-secondary font-bold text-sm hover:opacity-90 transition-all flex items-center space-x-2">
                  <span className="material-symbols-outlined text-lg">info</span>
                  <span>Full Manifest</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}

export default function LiveTrackingPage() {
  return (
    <Suspense fallback={null}>
      <LiveTrackingPageInner />
    </Suspense>
  )
}
