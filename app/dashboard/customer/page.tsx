'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'
import { MultiDriverMapDynamic } from '@/components/tracking/multi-driver-map-dynamic'
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

type ActiveDelivery = {
  id: string
  tracking_number: string | null
  status: string
  pickup_address: string | null
  delivery_address: string | null
  driver_id: string | null
  driver_name: string | null
}

const ACTIVE_STATUSES = ['accepted', 'collected', 'picked_up', 'in_transit']

const STATUS_DISPLAY: Record<string, { label: string; cls: string }> = {
  requested:  { label: 'REQUESTED',  cls: 'bg-secondary/10 text-secondary border border-secondary/20' },
  accepted:   { label: 'ACCEPTED',   cls: 'bg-secondary/10 text-secondary border border-secondary/20' },
  collected:  { label: 'COLLECTED',  cls: 'bg-tertiary/10 text-tertiary border border-tertiary/20' },
  in_transit: { label: 'IN TRANSIT', cls: 'bg-primary/10 text-primary border border-primary/20' },
  picked_up:  { label: 'PICKED UP',  cls: 'bg-tertiary/10 text-tertiary border border-tertiary/20' },
  delivered:  { label: 'DELIVERED',  cls: 'bg-outline-variant/20 text-on-surface-variant' },
  cancelled:  { label: 'CANCELLED',  cls: 'bg-error/10 text-error border border-error/20' },
}

function trackingId(d: DeliveryRow | ActiveDelivery) {
  return d.tracking_number || `KV-${d.id.slice(0, 8).toUpperCase()}`
}

function formatRoute(d: DeliveryRow) {
  const from = d.pickup_address?.split(',')[0]?.trim() || '—'
  const to = d.delivery_address?.split(',')[0]?.trim() || '—'
  return `${from} → ${to}`
}

function formatDateTime(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function CustomerDashboardPage() {
  const [showModal, setShowModal] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const [recent, setRecent] = useState<DeliveryRow[]>([])
  const [activeCount, setActiveCount] = useState(0)
  const [completedThisMonth, setCompletedThisMonth] = useState(0)
  const [totalSpent, setTotalSpent] = useState(0)
  const [activeDeliveries, setActiveDeliveries] = useState<ActiveDelivery[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const [recentRes, activeRes, monthRes, deliveredRes, activeDelivsRes] = await Promise.all([
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
          .not('status', 'in', '("delivered","cancelled")'),
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
          .select('id, tracking_number, status, pickup_address, delivery_address, driver_id')
          .eq('customer_id', user.id)
          .in('status', ACTIVE_STATUSES)
          .order('created_at', { ascending: false }),
      ])

      if (cancelled) return

      setRecent((recentRes.data ?? []) as DeliveryRow[])
      setActiveCount(activeRes.count ?? 0)
      setCompletedThisMonth(monthRes.count ?? 0)
      setTotalSpent(((deliveredRes.data ?? []) as any[]).reduce((s, r) => s + (Number(r.price) || 0), 0))

      // Resolve driver names
      const delivs = (activeDelivsRes.data ?? []) as Omit<ActiveDelivery, 'driver_name'>[]
      const driverIds = [...new Set(delivs.map((d) => d.driver_id).filter(Boolean))] as string[]
      let nameMap: Record<string, string> = {}
      if (driverIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', driverIds)
        for (const u of users ?? []) {
          nameMap[(u as any).id] = (u as any).full_name ?? 'Driver'
        }
      }
      if (!cancelled) {
        setActiveDeliveries(
          delivs.map((d) => ({ ...d, driver_name: d.driver_id ? (nameMap[d.driver_id] ?? 'Driver') : null }))
        )
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const formattedSpent = totalSpent.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const hasActive = activeDeliveries.length > 0

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} />
      <main className="pt-16 md:pl-64 min-h-screen bg-surface-container-low">
        <div className="max-w-7xl mx-auto p-6 pb-32">

          {/* Page Header */}
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
              className="bg-primary text-on-primary px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 hover:brightness-110 transition-all active:scale-95"
              style={{ boxShadow: '0 0 15px rgba(163,166,255,0.15)' }}
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              NEW SHIPMENT
            </button>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em]">Active Deliveries</p>
                <p className="font-headline text-3xl font-extrabold text-on-surface">{activeCount}</p>
              </div>
            </div>
            <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em]">Completed MTD</p>
                <p className="font-headline text-3xl font-extrabold text-on-surface">{completedThisMonth}</p>
              </div>
            </div>
            <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-tertiary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em]">Total Spent</p>
                <p className="font-headline text-3xl font-extrabold text-on-surface">{formattedSpent}</p>
              </div>
            </div>
          </div>

          {/* Live Tracking Section — half map, half driver list */}
          {hasActive && (
            <div className="mb-6 bg-surface-container rounded-2xl border border-outline-variant/10 overflow-hidden shadow-xl">
              {/* Section header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant/10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <p className="text-sm font-bold text-on-surface uppercase tracking-wider">Live Tracking</p>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                    {activeDeliveries.length} active
                  </span>
                </div>
                <Link
                  href="/dashboard/customer/tracking"
                  className="text-primary text-xs font-bold uppercase tracking-widest hover:underline"
                >
                  Full View →
                </Link>
              </div>

              {/* Map + Driver list side by side */}
              <div className="flex flex-col lg:flex-row" style={{ minHeight: 380 }}>

                {/* Map — left half */}
                <div className="flex-1 min-h-[280px] lg:min-h-0">
                  <MultiDriverMapDynamic
                    deliveries={activeDeliveries}
                    height="100%"
                    className="h-full w-full"
                  />
                </div>

                {/* Driver list — right half */}
                <div className="w-full lg:w-72 xl:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-outline-variant/10 overflow-y-auto" style={{ maxHeight: 400 }}>
                  <div className="px-4 py-3 border-b border-outline-variant/10">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                      Active Drivers
                    </p>
                  </div>
                  <div className="divide-y divide-outline-variant/10">
                    {activeDeliveries.map((d) => {
                      const statusMeta = STATUS_DISPLAY[d.status] ?? { label: d.status.toUpperCase(), cls: 'bg-surface-container-highest text-on-surface-variant' }
                      return (
                        <Link
                          key={d.id}
                          href={`/dashboard/customer/tracking?id=${d.id}`}
                          className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-container-high transition-colors group"
                        >
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {d.driver_name ? getInitials(d.driver_name) : '?'}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-on-surface truncate">
                              {d.driver_name ?? 'Awaiting driver'}
                            </p>
                            <p className="text-[10px] text-on-surface-variant truncate">
                              {trackingId(d)}
                            </p>
                            {d.delivery_address && (
                              <p className="text-[10px] text-on-surface-variant truncate">
                                → {d.delivery_address.split(',')[0]}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusMeta.cls}`}>
                              {statusMeta.label}
                            </span>
                            {d.driver_id ? (
                              <span className="flex items-center gap-1 text-[9px] text-green-400 font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                LIVE
                              </span>
                            ) : (
                              <span className="text-[9px] text-on-surface-variant">No driver</span>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Deliveries */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 bg-surface-container p-6 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between mb-5">
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
                    <button
                      onClick={() => setShowModal(true)}
                      className="mt-4 bg-primary text-on-primary px-5 py-2 rounded-full font-bold text-xs hover:brightness-110 transition-all"
                    >
                      Create your first delivery
                    </button>
                  </div>
                ) : (
                  recent.map((delivery) => {
                    const statusKey = (delivery.status || 'requested').toLowerCase()
                    const statusMeta = STATUS_DISPLAY[statusKey] ?? { label: statusKey.replace(/_/g, ' ').toUpperCase(), cls: 'bg-surface-container-highest text-on-surface-variant' }
                    return (
                      <div key={delivery.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-surface-container-high transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-primary shrink-0">
                            <span className="material-symbols-outlined text-lg">package_2</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-on-surface">{trackingId(delivery)}</p>
                            <p className="text-xs text-on-surface-variant truncate">{formatRoute(delivery)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <p className="text-xs text-on-surface-variant hidden md:block">{formatDateTime(delivery.created_at)}</p>
                          <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${statusMeta.cls}`}>
                            {statusMeta.label}
                          </span>
                          <span className="material-symbols-outlined text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity text-lg">chevron_right</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}
