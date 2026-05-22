'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'
import dynamic from 'next/dynamic'
const GoogleMultiDriver = dynamic(
  () => import('@/components/maps/google-multi-driver').then((m) => m.GoogleMultiDriver),
  { ssr: false }
)
import { createClient } from '@/lib/supabase/client'
import { getDriverNamesByIds } from '@/app/actions/driver'

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
  pickup_lat: number | null
  pickup_lng: number | null
  delivery_lat: number | null
  delivery_lng: number | null
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
  const to   = d.delivery_address?.split(',')[0]?.trim() || '—'
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

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function CustomerDashboardPage() {
  const [showModal, setShowModal]   = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const [userId,             setUserId]             = useState('')
  const [userName,           setUserName]           = useState('')
  const [recent,             setRecent]             = useState<DeliveryRow[]>([])
  const [activeCount,        setActiveCount]        = useState(0)
  const [completedThisMonth, setCompletedThisMonth] = useState(0)
  const [totalSpent,         setTotalSpent]         = useState(0)
  const [activeDeliveries,   setActiveDeliveries]   = useState<ActiveDelivery[]>([])
  const [focusedDeliveryId,  setFocusedDeliveryId]  = useState<string | null>(null)

  // Listen for FAB event from BottomNav (layout also listens, but this handles
  // the case where the user triggers via keyboard / other means on dashboard)
  useEffect(() => {
    const open = () => setShowModal(true)
    document.addEventListener('open-new-delivery', open)
    return () => document.removeEventListener('open-new-delivery', open)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      if (!cancelled) setUserId(user.id)

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const [recentRes, activeRes, monthRes, deliveredRes, activeDelivsRes, profileRes] = await Promise.all([
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
          .select('id, tracking_number, status, pickup_address, delivery_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng, driver_id')
          .eq('customer_id', user.id)
          .in('status', ACTIVE_STATUSES)
          .order('created_at', { ascending: false }),
        supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle(),
      ])

      if (cancelled) return

      setRecent((recentRes.data ?? []) as DeliveryRow[])
      setActiveCount(activeRes.count ?? 0)
      setCompletedThisMonth(monthRes.count ?? 0)
      setTotalSpent(((deliveredRes.data ?? []) as any[]).reduce((s, r) => s + (Number(r.price) || 0), 0))
      if (profileRes.data?.full_name) setUserName(profileRes.data.full_name.split(' ')[0])

      const delivs = (activeDelivsRes.data ?? []) as Omit<ActiveDelivery, 'driver_name'>[]
      const driverIds = [...new Set(delivs.map((d) => d.driver_id).filter(Boolean))] as string[]
      const nameMap = await getDriverNamesByIds(driverIds)
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
  const hasActive      = activeDeliveries.length > 0
  const greeting       = getGreeting()

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} userId={userId} />

      <main className="pt-16 md:pl-64 min-h-screen bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-28 md:pb-12">

          {/* ══════════════════════════════════════════════════
              DESKTOP: page header + NEW SHIPMENT button
          ══════════════════════════════════════════════════ */}
          <div className="hidden md:flex items-center justify-between mb-8">
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

          {/* ══════════════════════════════════════════════════
              MOBILE: hero greeting card
          ══════════════════════════════════════════════════ */}
          <div className="md:hidden mb-5">
            <div
              className="relative rounded-3xl overflow-hidden p-5 pt-6"
              style={{ background: 'linear-gradient(135deg, rgba(163,166,255,0.15) 0%, rgba(193,128,255,0.08) 60%, rgba(255,165,217,0.05) 100%)', border: '1px solid rgba(163,166,255,0.15)' }}
            >
              {/* Glow blob */}
              <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-secondary/10 blur-2xl pointer-events-none" />

              <p className="text-[11px] text-primary font-bold uppercase tracking-[0.18em] mb-0.5">{greeting}</p>
              <h2 className="text-2xl font-black text-white font-headline tracking-tight">
                {userName || 'Welcome back'}
              </h2>

              {/* Inline quick stats */}
              <div className="flex items-center gap-3 mt-4">
                <div className="flex-1 bg-surface-container/60 rounded-2xl px-3 py-2.5 text-center backdrop-blur-sm">
                  <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Active</p>
                  <p className="text-xl font-black font-headline text-primary">{activeCount}</p>
                </div>
                <div className="flex-1 bg-surface-container/60 rounded-2xl px-3 py-2.5 text-center backdrop-blur-sm">
                  <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Done MTD</p>
                  <p className="text-xl font-black font-headline text-secondary">{completedThisMonth}</p>
                </div>
                <div className="flex-1 bg-surface-container/60 rounded-2xl px-3 py-2.5 text-center backdrop-blur-sm">
                  <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Spent</p>
                  <p className="text-xl font-black font-headline text-tertiary">{formattedSpent}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              DESKTOP: stat cards grid
          ══════════════════════════════════════════════════ */}
          <div className="hidden md:grid grid-cols-3 gap-4 mb-6">
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

          {/* ══════════════════════════════════════════════════
              MOBILE: active deliveries — compact horizontal scroll
          ══════════════════════════════════════════════════ */}
          {hasActive && (
            <div className="md:hidden mb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <p className="text-sm font-black text-on-surface font-headline">Live</p>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                    {activeDeliveries.length} active
                  </span>
                </div>
                <Link
                  href="/dashboard/customer/tracking"
                  className="text-[11px] font-bold text-primary uppercase tracking-widest flex items-center gap-1"
                >
                  Map
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>

              {/* Horizontal scroll cards */}
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
                {activeDeliveries.map((d) => {
                  const statusMeta = STATUS_DISPLAY[d.status] ?? { label: d.status.toUpperCase(), cls: 'bg-surface-container-highest text-on-surface-variant' }
                  return (
                    <div
                      key={d.id}
                      className="flex-shrink-0 w-52 bg-surface-container rounded-2xl p-4 border border-outline-variant/10"
                      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                    >
                      {/* Driver avatar + name */}
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-black shrink-0">
                          {d.driver_name ? getInitials(d.driver_name) : '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-on-surface truncate leading-tight">
                            {d.driver_name ?? 'Awaiting driver'}
                          </p>
                          <p className="text-[10px] text-on-surface-variant font-mono">{trackingId(d)}</p>
                        </div>
                        {d.driver_id && (
                          <span className="flex items-center gap-0.5 text-[9px] text-green-400 font-bold shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            LIVE
                          </span>
                        )}
                      </div>

                      {/* Status */}
                      <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mb-3 ${statusMeta.cls}`}>
                        {statusMeta.label}
                      </span>

                      {/* Destination */}
                      {d.delivery_address && (
                        <p className="text-[10px] text-on-surface-variant truncate mb-3">
                          <span className="text-on-surface-variant mr-1">→</span>
                          {d.delivery_address.split(',')[0]}
                        </p>
                      )}

                      {/* Track CTA */}
                      <Link
                        href={`/dashboard/customer/tracking?id=${d.id}`}
                        className="block w-full text-center bg-primary/10 text-primary text-[10px] font-bold py-2 rounded-xl border border-primary/20 active:scale-95 transition-transform"
                      >
                        Track →
                      </Link>
                    </div>
                  )
                })}

                {/* End card: open map */}
                <Link
                  href="/dashboard/customer/tracking"
                  className="flex-shrink-0 w-20 bg-surface-container rounded-2xl border border-outline-variant/10 flex flex-col items-center justify-center gap-2 text-on-surface-variant hover:text-primary hover:border-primary/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-2xl">map</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-center leading-tight">
                    Full<br />Map
                  </span>
                </Link>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              DESKTOP: live tracking (map + driver list)
          ══════════════════════════════════════════════════ */}
          {hasActive && (
            <div className="hidden md:block mb-6 bg-surface-container rounded-2xl border border-outline-variant/10 overflow-hidden shadow-xl">
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

              {/* Map + Driver list */}
              <div className="flex flex-col lg:flex-row" style={{ minHeight: 380 }}>
                <div className="flex-1 min-h-[280px] lg:min-h-0">
                  <GoogleMultiDriver
                    deliveries={activeDeliveries}
                    focusedDeliveryId={focusedDeliveryId ?? activeDeliveries[0]?.id ?? null}
                    height="100%"
                    className="h-full w-full"
                  />
                </div>
                <div className="w-full lg:w-72 xl:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-outline-variant/10 overflow-y-auto" style={{ maxHeight: 400 }}>
                  <div className="px-4 py-3 border-b border-outline-variant/10">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Active Drivers</p>
                  </div>
                  <div className="divide-y divide-outline-variant/10">
                    {activeDeliveries.map((d) => {
                      const statusMeta = STATUS_DISPLAY[d.status] ?? { label: d.status.toUpperCase(), cls: 'bg-surface-container-highest text-on-surface-variant' }
                      const isFocused = (focusedDeliveryId ?? activeDeliveries[0]?.id) === d.id
                      return (
                        <button
                          key={d.id}
                          onClick={() => setFocusedDeliveryId(d.id)}
                          className={`w-full text-left flex items-center gap-3 px-4 py-3.5 transition-colors group ${isFocused ? 'bg-primary/5 border-l-2 border-primary' : 'hover:bg-surface-container-high border-l-2 border-transparent'}`}
                        >
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${isFocused ? 'bg-primary/20 border-primary/40' : 'bg-primary/10 border-primary/20'}`}>
                            <span className="text-xs font-bold text-primary">
                              {d.driver_name ? getInitials(d.driver_name) : '?'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-on-surface truncate">{d.driver_name ?? 'Awaiting driver'}</p>
                            <p className="text-[10px] text-on-surface-variant truncate">{trackingId(d)}</p>
                            {d.delivery_address && (
                              <p className="text-[10px] text-on-surface-variant truncate">→ {d.delivery_address.split(',')[0]}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusMeta.cls}`}>{statusMeta.label}</span>
                            {d.driver_id && (
                              <span className="flex items-center gap-1 text-[9px] text-green-400 font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />LIVE
                              </span>
                            )}
                            <Link href={`/dashboard/customer/tracking?id=${d.id}`} onClick={(e) => e.stopPropagation()} className="text-[9px] text-primary font-bold hover:underline">Track →</Link>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              MOBILE: empty state — no active deliveries
          ══════════════════════════════════════════════════ */}
          {!hasActive && (
            <div className="md:hidden mb-5">
              <button
                onClick={() => setShowModal(true)}
                className="w-full rounded-3xl border-2 border-dashed border-primary/25 bg-primary/5 flex items-center gap-4 px-5 py-5 active:scale-[0.98] transition-transform"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    add_circle
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-white font-headline">Book a delivery</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Tap to create your first shipment</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant ml-auto">chevron_right</span>
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              MOBILE: quick action strips
          ══════════════════════════════════════════════════ */}
          <div className="md:hidden mb-5">
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
              {[
                { href: '/dashboard/customer/active-deliveries', icon: 'package_2',  label: 'All Shipments', color: 'primary'    },
                { href: '/dashboard/customer/tracking',          icon: 'explore',     label: 'Live Map',      color: 'secondary'  },
                { href: '/dashboard/customer/history',           icon: 'history',     label: 'History',       color: 'tertiary'   },
                { href: '/dashboard/customer/payments',          icon: 'payments',    label: 'Payments',      color: 'error'      },
              ].map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="flex-shrink-0 flex flex-col items-center gap-2 bg-surface-container rounded-2xl px-4 py-3.5 border border-outline-variant/10 active:scale-95 transition-transform min-w-[72px]"
                >
                  <div className={`w-10 h-10 rounded-xl bg-${q.color}/10 flex items-center justify-center`}>
                    <span className={`material-symbols-outlined text-${q.color} text-xl`} style={{ fontVariationSettings: "'FILL' 1" }}>
                      {q.icon}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-on-surface-variant text-center leading-tight uppercase tracking-wider whitespace-nowrap">
                    {q.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              RECENT DELIVERIES (both mobile + desktop)
          ══════════════════════════════════════════════════ */}
          <div className="bg-surface-container rounded-2xl md:rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
              <h4 className="font-headline text-base md:text-lg font-bold text-on-surface">Recent Deliveries</h4>
              <Link
                href="/dashboard/customer/active-deliveries"
                className="text-primary text-[10px] md:text-xs font-bold uppercase tracking-widest hover:underline flex items-center gap-1"
              >
                View All
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="p-8 md:p-12 text-center flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-surface-container-highest flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-surface-variant text-2xl">inventory_2</span>
                </div>
                <p className="text-sm font-bold text-on-surface">No deliveries yet</p>
                <p className="text-xs text-on-surface-variant">Create your first delivery to get started.</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-2 bg-primary text-on-primary px-5 py-2 rounded-full font-bold text-xs hover:brightness-110 transition-all active:scale-95"
                >
                  Create delivery
                </button>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/8">
                {recent.map((delivery) => {
                  const statusKey  = (delivery.status || 'requested').toLowerCase()
                  const statusMeta = STATUS_DISPLAY[statusKey] ?? { label: statusKey.replace(/_/g, ' ').toUpperCase(), cls: 'bg-surface-container-highest text-on-surface-variant' }
                  const isActive   = ACTIVE_STATUSES.includes(delivery.status ?? '')
                  const href = isActive
                    ? `/dashboard/customer/tracking?id=${delivery.id}`
                    : `/dashboard/customer/history`
                  return (
                    <Link
                      key={delivery.id}
                      href={href}
                      className="flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3.5 md:py-4 hover:bg-surface-container-high active:bg-surface-container-high transition-colors group cursor-pointer"
                    >
                      {/* Icon */}
                      <div className="w-10 h-10 bg-surface-container-highest rounded-xl md:rounded-full flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-lg" style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                          {isActive ? 'local_shipping' : 'package_2'}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-on-surface font-mono">{trackingId(delivery)}</p>
                        <p className="text-[11px] text-on-surface-variant truncate mt-0.5">{formatRoute(delivery)}</p>
                      </div>

                      {/* Right */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-[9px] md:text-[10px] font-bold px-2.5 py-1 rounded-full ${statusMeta.cls}`}>
                          {statusMeta.label}
                        </span>
                        <p className="text-[10px] text-on-surface-variant hidden md:block">{formatDateTime(delivery.created_at)}</p>
                      </div>

                      <span className="material-symbols-outlined text-on-surface-variant/40 text-lg group-hover:text-on-surface-variant transition-colors shrink-0">
                        chevron_right
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}
