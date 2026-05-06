'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'
import { LiveTrackingPanel } from '@/components/tracking/live-tracking-panel'
import { createClient } from '@/lib/supabase/client'

type DeliveryRow = {
  id: string
  tracking_number: string | null
  pickup_address: string | null
  delivery_address: string | null
  item_description: string | null
  price: number | null
  status: string | null
  created_at: string | null
}

type ActiveShipment = {
  id: string
  tracking_number: string | null
  status: string | null
  pickup_address: string | null
  delivery_address: string | null
  driver_id: string | null
  pickup_lat: number | null
  pickup_lng: number | null
  delivery_lat: number | null
  delivery_lng: number | null
  driver_name: string | null
}

const ACTIVE_STATUSES = ['accepted', 'collected', 'picked_up', 'in_transit']

const STATUS_DISPLAY: Record<string, { label: string; cls: string }> = {
  requested: { label: 'REQUESTED', cls: 'bg-secondary/10 text-secondary border border-secondary/20' },
  accepted: { label: 'ACCEPTED', cls: 'bg-secondary/10 text-secondary border border-secondary/20' },
  collected: { label: 'COLLECTED', cls: 'bg-tertiary/10 text-tertiary border border-tertiary/20' },
  in_transit: { label: 'IN TRANSIT', cls: 'bg-primary/10 text-primary border border-primary/20' },
  delivered: { label: 'DELIVERED', cls: 'bg-outline-variant/20 text-on-surface-variant' },
  cancelled: { label: 'CANCELLED', cls: 'bg-error/10 text-error border border-error/20' },
}

function trackingId(d: DeliveryRow) {
  return d.tracking_number || `KV-${d.id.slice(0, 8).toUpperCase()}`
}

function formatRoute(d: DeliveryRow) {
  const from = d.pickup_address?.split(',')[0]?.trim() || '—'
  const to = d.delivery_address?.split(',')[0]?.trim() || '—'
  return `${from} → ${to}`
}

function formatDateTime(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CustomerDashboardPage() {
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState('Overview')
  const tabs = ['Overview', 'Quick Book', 'Active Tracking', 'History']

  const supabase = useMemo(() => createClient(), [])
  const [recent, setRecent] = useState<DeliveryRow[]>([])
  const [activeCount, setActiveCount] = useState(0)
  const [completedThisMonth, setCompletedThisMonth] = useState(0)
  const [totalSpent, setTotalSpent] = useState(0)
  const [activeShipment, setActiveShipment] = useState<ActiveShipment | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const [recentRes, activeRes, monthRes, deliveredRes, activeShipmentRes] = await Promise.all([
        supabase
          .from('delivery_requests')
          .select('id, tracking_number, pickup_address, delivery_address, item_description, price, status, created_at')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('delivery_requests')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', user.id)
          .neq('status', 'delivered'),
        supabase
          .from('delivery_requests')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', user.id)
          .eq('status', 'delivered')
          .gte('created_at', startOfMonth.toISOString()),
        supabase
          .from('delivery_requests')
          .select('price')
          .eq('customer_id', user.id)
          .eq('status', 'delivered'),
        supabase
          .from('delivery_requests')
          .select('id, tracking_number, status, pickup_address, delivery_address, driver_id, pickup_lat, pickup_lng, delivery_lat, delivery_lng')
          .eq('customer_id', user.id)
          .in('status', ACTIVE_STATUSES)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (cancelled) return

      if (recentRes.error) console.error('[v0] dashboard recent error', recentRes.error)
      else setRecent((recentRes.data ?? []) as DeliveryRow[])

      if (activeRes.error) console.error('[v0] dashboard active error', activeRes.error)
      else setActiveCount(activeRes.count ?? 0)

      if (monthRes.error) console.error('[v0] dashboard month error', monthRes.error)
      else setCompletedThisMonth(monthRes.count ?? 0)

      if (deliveredRes.error) console.error('[v0] dashboard spend error', deliveredRes.error)
      else setTotalSpent((deliveredRes.data ?? []).reduce((s, r: any) => s + (Number(r.price) || 0), 0))

      if (activeShipmentRes.error) {
        console.error('[v0] active shipment error', activeShipmentRes.error)
        setActiveShipment(null)
      } else if (activeShipmentRes.data) {
        const ship = activeShipmentRes.data as Omit<ActiveShipment, 'driver_name'>
        let driver_name: string | null = null
        if (ship.driver_id) {
          const { data: drv } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', ship.driver_id)
            .maybeSingle()
          driver_name = (drv as any)?.full_name ?? null
        }
        if (!cancelled) setActiveShipment({ ...ship, driver_name })
      } else {
        setActiveShipment(null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const formattedSpent = totalSpent.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} />
      <main className="pt-16 md:pl-64 min-h-screen bg-surface-container-low">
        <div className="max-w-7xl mx-auto p-8 pb-32">
          {/* Page Header & Sub-Tabs */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-headline text-3xl font-extrabold text-on-surface tracking-tighter">
                  Command Center
                </h2>
                <p className="text-on-surface-variant mt-1 text-sm">
                  Real-time logistics overview and orchestration.
                </p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="bg-primary text-on-primary px-6 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 shadow-[0_0_15px_rgba(163,166,255,0.1)] hover:brightness-110 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                NEW SHIPMENT
              </button>
            </div>
            {/* Sub-Navigation Tabs */}
            <div className="flex gap-8 border-b border-outline-variant/10">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-4 text-sm transition-all ${
                    activeTab === tab
                      ? 'font-bold text-primary border-b-2 border-primary'
                      : 'font-medium text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Live Tracking Widget — visible only when there's an active shipment */}
          {activeShipment && (
            <div className="mb-6 bg-surface-container rounded-2xl shadow-xl overflow-hidden border border-outline-variant/10">
              <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span
                      className="material-symbols-outlined text-primary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      my_location
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                      Live Tracking
                    </p>
                    <h4 className="font-headline text-lg font-bold text-on-surface truncate">
                      {activeShipment.tracking_number || `KV-${activeShipment.id.slice(0, 8).toUpperCase()}`}
                      {activeShipment.driver_name ? ` · ${activeShipment.driver_name}` : ''}
                    </h4>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    {(activeShipment.status || 'tracking').replace(/_/g, ' ')}
                  </span>
                  <Link
                    href={`/dashboard/customer/tracking?id=${activeShipment.id}`}
                    className="text-primary text-xs font-bold uppercase tracking-widest hover:underline"
                  >
                    Open Full
                  </Link>
                </div>
              </div>
              <div className="p-4">
                <LiveTrackingPanel
                  driverId={activeShipment.driver_id}
                  pickup={
                    activeShipment.pickup_lat != null && activeShipment.pickup_lng != null
                      ? { lat: Number(activeShipment.pickup_lat), lng: Number(activeShipment.pickup_lng) }
                      : null
                  }
                  destination={
                    activeShipment.delivery_lat != null && activeShipment.delivery_lng != null
                      ? { lat: Number(activeShipment.delivery_lat), lng: Number(activeShipment.delivery_lng) }
                      : null
                  }
                  driverLabel={activeShipment.driver_name ?? 'Driver'}
                  height={360}
                />
                {!activeShipment.driver_id && (
                  <p className="text-xs text-on-surface-variant mt-3">
                    Waiting for a driver to accept your delivery. The map will go live as soon as a driver is assigned.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-12 gap-6">
            {/* Stat Card: Active Deliveries */}
            <div className="col-span-12 md:col-span-4 glass-card p-6 rounded-2xl flex flex-col justify-between h-48">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mb-1">
                    Active Deliveries
                  </p>
                  <h3 className="font-headline text-4xl font-extrabold text-on-surface">{activeCount}</h3>
                </div>
                <div className="bg-primary/10 p-2 rounded-lg">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    local_shipping
                  </span>
                </div>
              </div>
              <div className="h-12 w-full mt-4 opacity-50 flex items-end gap-1">
                {[4, 8, 6, 10, 5, 9, 12].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary rounded-t-sm"
                    style={{ height: `${h * 4}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Stat Card: Completed */}
            <div className="col-span-12 md:col-span-4 glass-card p-6 rounded-2xl flex flex-col justify-between h-48">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mb-1">
                    Completed MTD
                  </p>
                  <h3 className="font-headline text-4xl font-extrabold text-on-surface">{completedThisMonth.toLocaleString()}</h3>
                </div>
                <div className="bg-secondary/10 p-2 rounded-lg">
                  <span
                    className="material-symbols-outlined text-secondary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    task_alt
                  </span>
                </div>
              </div>
              <div className="h-12 w-full mt-4 opacity-50 flex items-end gap-1">
                {[8, 5, 11, 6, 10, 4, 7].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-secondary rounded-t-sm"
                    style={{ height: `${h * 4}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Stat Card: Total Spent */}
            <div className="col-span-12 md:col-span-4 glass-card p-6 rounded-2xl flex flex-col justify-between h-48">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mb-1">
                    Total Spent (USD)
                  </p>
                  <h3 className="font-headline text-4xl font-extrabold text-on-surface">{formattedSpent}</h3>
                </div>
                <div className="bg-tertiary/10 p-2 rounded-lg">
                  <span
                    className="material-symbols-outlined text-tertiary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    payments
                  </span>
                </div>
              </div>
              <div className="h-12 w-full mt-4 opacity-50 flex items-end gap-1">
                {[10, 4, 6, 8, 11, 5, 9].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-tertiary rounded-t-sm"
                    style={{ height: `${h * 4}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Recent Deliveries List */}
            <div className="col-span-12 lg:col-span-8 bg-surface-container p-6 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-headline text-lg font-bold text-on-surface">Recent Deliveries</h4>
                <Link
                  href="/dashboard/customer/active-deliveries"
                  className="text-primary text-xs font-bold uppercase tracking-widest hover:underline"
                >
                  View All
                </Link>
              </div>
              <div className="space-y-2">
                {recent.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-on-surface-variant">No deliveries yet.</p>
                  </div>
                ) : (
                  recent.map((delivery) => {
                    const statusKey = (delivery.status || 'requested').toLowerCase()
                    const statusMeta = STATUS_DISPLAY[statusKey] ?? {
                      label: statusKey.replace(/_/g, ' ').toUpperCase(),
                      cls: 'bg-surface-container-highest text-on-surface-variant',
                    }
                    const isDelivered = statusKey === 'delivered'
                    return (
                      <div
                        key={delivery.id}
                        className="flex items-center justify-between p-4 rounded-xl hover:bg-surface-container-high transition-colors group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-surface-container-highest rounded-full flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined">package_2</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-on-surface">{trackingId(delivery)}</p>
                            <p className="text-xs text-on-surface-variant">{formatRoute(delivery)}</p>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-6">
                          <div className="hidden md:block">
                            <p className="text-xs text-on-surface-variant">{isDelivered ? 'Completed on' : 'Created'}</p>
                            <p className="text-xs font-medium">{formatDateTime(delivery.created_at)}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${statusMeta.cls}`}>
                            {statusMeta.label}
                          </span>
                          <span className="material-symbols-outlined text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">
                            chevron_right
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Quick Book Widget */}
            <div className="col-span-12 lg:col-span-4 bg-surface-container p-8 rounded-2xl border border-outline-variant/10 relative overflow-hidden">
              <div className="absolute -right-16 -top-16 w-48 h-48 bg-primary/10 blur-[60px] rounded-full" />
              <div className="relative z-10">
                <h4 className="font-headline text-lg font-bold text-on-surface mb-2">Quick Book</h4>
                <p className="text-sm text-on-surface-variant mb-6">Dispatch a local courier in seconds.</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider mb-1 block">
                      Pick-up Location
                    </label>
                    <div className="relative">
                      <input
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 pl-10 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 outline-none"
                        type="text"
                        defaultValue="HQ Main Office, CA"
                      />
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-[18px]">
                        location_on
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider mb-1 block">
                      Destination
                    </label>
                    <div className="relative">
                      <input
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 pl-10 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 outline-none"
                        placeholder="Enter address..."
                        type="text"
                      />
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                        navigation
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider mb-1 block">
                        Weight
                      </label>
                      <select className="w-full bg-surface-container-highest border-none rounded-xl py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary/50">
                        <option>0-5 kg</option>
                        <option>5-20 kg</option>
                        <option>20kg+</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider mb-1 block">
                        Priority
                      </label>
                      <select className="w-full bg-surface-container-highest border-none rounded-xl py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary/50">
                        <option>Standard</option>
                        <option>Express</option>
                        <option>Instant</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowModal(true)}
                    className="w-full bg-on-surface text-surface py-4 rounded-xl font-bold uppercase tracking-widest text-xs mt-4 hover:bg-primary hover:text-on-primary transition-all active:scale-95"
                  >
                    Estimate Cost
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}
