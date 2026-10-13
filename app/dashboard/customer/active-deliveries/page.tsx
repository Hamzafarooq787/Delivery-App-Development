'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'
import { SubTabs } from '@/components/ui/sub-tabs'
import { CustomerLocationBroadcaster } from '@/components/tracking/customer-location-broadcaster'
import { createClient } from '@/lib/supabase/client'
import { getDriverNamesByIds } from '@/app/actions/driver'
import { CancelOrderButton } from '@/components/customer/cancel-order-button'

type DeliveryRow = {
  id: string
  tracking_number: string | null
  customer_id: string | null
  driver_id: string | null
  pickup_address: string | null
  delivery_address: string | null
  item_description: string | null
  price: number | null
  status: string | null
  created_at: string | null
}

const ACTIVE_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  requested: { label: 'Requested', cls: 'bg-secondary/10 text-secondary' },
  accepted: { label: 'Accepted', cls: 'bg-secondary/10 text-secondary' },
  collected: { label: 'Collected', cls: 'bg-tertiary/10 text-tertiary' },
  in_transit: { label: 'In Transit', cls: 'bg-primary/10 text-primary' },
  cancelled: { label: 'Cancelled', cls: 'bg-error/10 text-error' },
}

const DRIVER_BG_PALETTE = ['bg-primary', 'bg-secondary', 'bg-tertiary']

function formatTrackingId(d: DeliveryRow) {
  if (d.tracking_number) return d.tracking_number
  return `KV-${d.id.slice(0, 4).toUpperCase()}`
}

function formatRoute(addr: string | null) {
  if (!addr) return 'Unknown'
  // Use just the first segment so the bento card stays clean
  return addr.split(',')[0]?.trim() || addr
}

export default function ActiveDeliveriesPage() {
  const [showModal, setShowModal] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [driverNames, setDriverNames] = useState<Record<string, string>>({})

  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Initial fetch
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) {
          setUserId(null)
          setDeliveries([])
          setLoading(false)
        }
        return
      }

      if (!cancelled) setUserId(user.id)

      const { data, error } = await supabase
        .from('delivery_requests')
        .select(
          'id, tracking_number, customer_id, driver_id, pickup_address, delivery_address, item_description, price, status, created_at'
        )
        .eq('customer_id', user.id)
        .neq('status', 'delivered')
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (error) {
        console.error('[v0] active deliveries fetch error', error)
        setDeliveries([])
      } else {
        const rows = (data ?? []) as DeliveryRow[]
        setDeliveries(rows)
        // Fetch driver names for assigned drivers
        const driverIds = [...new Set(rows.map((r) => r.driver_id).filter(Boolean) as string[])]
        if (driverIds.length > 0) {
          getDriverNamesByIds(driverIds).then((nameMap) => {
            if (nameMap && !cancelled) setDriverNames(nameMap)
          })
        }
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  // Realtime subscription scoped to this customer
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`customer-active-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_requests',
          filter: `customer_id=eq.${userId}`,
        },
        (payload) => {
          setDeliveries((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as DeliveryRow
              if (row.status === 'delivered') return prev
              if (prev.some((r) => r.id === row.id)) return prev
              return [row, ...prev]
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as DeliveryRow
              const next = prev.filter((r) => r.id !== row.id)
              if (row.status !== 'delivered') {
                next.unshift(row)
              }
              return next
            }
            if (payload.eventType === 'DELETE') {
              const row = payload.old as DeliveryRow
              return prev.filter((r) => r.id !== row.id)
            }
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId])

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} />
      <main className="pt-16 pb-28 md:pb-8 px-4 md:pl-72 md:pr-8 min-h-screen bg-surface-container-low">

        {/* ── Page header ── */}
        <div className="pt-5 md:pt-8 mb-6 md:mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight text-on-surface">
              Shipments
            </h2>
            <SubTabs
              className="mt-4"
              tabs={[
                { label: 'Active',  href: '/dashboard/customer/active-deliveries', icon: 'local_shipping' },
                { label: 'History', href: '/dashboard/customer/history',           icon: 'history' },
              ]}
            />
            <p className="text-on-surface-variant text-sm mt-3">
              Real-time status of all your active deliveries.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-surface-container rounded-xl px-3 py-2 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]" />
              <span className="text-xs font-bold text-on-surface uppercase tracking-widest">
                {deliveries.length} live
              </span>
            </div>
            {deliveries.some((d) => ['accepted', 'collected', 'in_transit'].includes(d.status ?? '')) && (
              <CustomerLocationBroadcaster
                deliveryId={deliveries.find((d) => ['accepted', 'collected', 'in_transit'].includes(d.status ?? ''))?.id}
              />
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-container animate-pulse" />
            <span className="text-xs text-on-surface-variant uppercase tracking-widest">Loading…</span>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="bg-surface-container rounded-2xl border border-outline-variant/10 px-6 py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-container-highest flex items-center justify-center text-primary mb-4">
              <span className="material-symbols-outlined text-2xl">inbox</span>
            </div>
            <h3 className="font-headline font-bold text-lg text-on-surface">No active deliveries</h3>
            <p className="text-sm text-on-surface-variant mt-2 max-w-xs">
              Create a delivery request and it will appear here in real time.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-6 bg-primary text-on-primary px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
            >
              New Delivery
            </button>
          </div>
        ) : (
          <>
            {/* ── MOBILE: native list ── */}
            <div className="md:hidden bg-surface-container rounded-2xl overflow-hidden border border-outline-variant/10">
              {deliveries.map((shipment, idx) => {
                const statusKey  = (shipment.status ?? 'requested').toLowerCase()
                const statusMeta = ACTIVE_STATUS_LABELS[statusKey] ?? { label: statusKey.replace(/_/g, ' '), cls: 'bg-surface-container-highest text-on-surface-variant' }
                const tid        = formatTrackingId(shipment)
                const driverBg   = DRIVER_BG_PALETTE[idx % DRIVER_BG_PALETTE.length]
                const driverName = shipment.driver_id ? (driverNames[shipment.driver_id] ?? null) : null
                const driverInitials = driverName
                  ? driverName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                  : shipment.driver_id ? 'DRV' : '?'

                return (
                  <div
                    key={shipment.id}
                    className="px-4 py-4 border-b border-outline-variant/8 last:border-b-0"
                  >
                    <div
                      className="flex items-center gap-4 active:bg-surface-container-high transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/customer/tracking?id=${shipment.id}`)}
                    >
                      {/* Driver avatar */}
                      <div className={`w-11 h-11 rounded-full ${driverBg} flex items-center justify-center text-xs font-black text-on-primary shrink-0`}>
                        {driverInitials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-on-surface font-mono">{tid}</p>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusMeta.cls}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant truncate">
                          {formatRoute(shipment.pickup_address)} → {formatRoute(shipment.delivery_address)}
                        </p>
                        {shipment.item_description && (
                          <p className="text-[10px] text-on-surface-variant/70 truncate mt-0.5">{shipment.item_description}</p>
                        )}
                      </div>

                      <span className="material-symbols-outlined text-on-surface-variant/40 text-lg shrink-0">chevron_right</span>
                    </div>
                    {/* Cancel button row */}
                    <div className="mt-3 flex justify-end" onClick={(e) => e.stopPropagation()}>
                      <CancelOrderButton
                        deliveryId={shipment.id}
                        currentStatus={shipment.status ?? ''}
                        onCancelled={() => setDeliveries(prev => prev.filter(d => d.id !== shipment.id))}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── DESKTOP: bento grid ── */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6">
              {deliveries.map((shipment, idx) => {
                const statusKey  = (shipment.status ?? 'requested').toLowerCase()
                const statusMeta = ACTIVE_STATUS_LABELS[statusKey] ?? { label: statusKey.replace(/_/g, ' '), cls: 'bg-surface-container-highest text-on-surface-variant' }
                const trackingId = formatTrackingId(shipment)
                const driverBg   = DRIVER_BG_PALETTE[idx % DRIVER_BG_PALETTE.length]
                const driverNameDesktop = shipment.driver_id ? (driverNames[shipment.driver_id] ?? null) : null
                const driverInitialsDesktop = driverNameDesktop
                  ? driverNameDesktop.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                  : shipment.driver_id ? 'DRV' : 'NA'

                return (
                  <div
                    key={shipment.id}
                    className="bg-surface-container rounded-xl overflow-hidden group transition-all duration-300 hover:bg-surface-container-high relative border border-transparent hover:border-primary/10"
                  >
                    <div className="absolute top-0 right-0 p-4">
                      <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${statusMeta.cls}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <div className="p-6">
                      <p className="text-[10px] font-label text-on-surface-variant uppercase tracking-[0.2em] mb-4">
                        Order ID: {trackingId}
                      </p>
                      {shipment.item_description && (
                        <p className="text-sm font-headline font-bold text-on-surface mb-6 line-clamp-1">
                          {shipment.item_description}
                        </p>
                      )}
                      <div className="flex flex-col gap-6 mb-8">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined">location_on</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-on-surface-variant uppercase font-semibold">Pickup</p>
                            <p className="text-on-surface font-headline font-bold truncate">{formatRoute(shipment.pickup_address)}</p>
                          </div>
                        </div>
                        <div className="ml-5 h-6 border-l-2 border-dashed border-outline-variant" />
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-secondary">
                            <span className="material-symbols-outlined">flag</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-on-surface-variant uppercase font-semibold">Destination</p>
                            <p className="text-on-surface font-headline font-bold truncate">{formatRoute(shipment.delivery_address)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-6 border-t border-outline-variant/10">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${driverBg} flex items-center justify-center text-[10px] font-bold text-on-primary`}>
                            {driverInitialsDesktop}
                          </div>
                          <div className="text-xs">
                            <p className="text-on-surface font-medium">{driverNameDesktop ?? (shipment.driver_id ? 'Driver assigned' : 'Awaiting driver')}</p>
                            <p className="text-on-surface-variant">{shipment.created_at ? new Date(shipment.created_at).toLocaleDateString() : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CancelOrderButton
                            deliveryId={shipment.id}
                            currentStatus={shipment.status ?? ''}
                            onCancelled={() => setDeliveries(prev => prev.filter(d => d.id !== shipment.id))}
                          />
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/customer/tracking?id=${shipment.id}`)}
                            className="bg-primary text-on-primary px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)]"
                          >
                            Track
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}

