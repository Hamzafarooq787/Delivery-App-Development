'use client'

import { useEffect, useMemo, useState } from 'react'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'
import { createClient } from '@/lib/supabase/client'

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
        setDeliveries((data ?? []) as DeliveryRow[])
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
      <main className="pt-24 pb-20 md:pb-8 pl-4 pr-4 md:pl-72 md:pr-8 min-h-screen bg-surface-container-low">
        {/* Header Section */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
              Active Deliveries
            </h2>
            <p className="text-on-surface-variant font-body text-sm mt-1">
              Real-time status of your kinetic fleet across global corridors.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-surface-container rounded-xl px-4 py-2 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#a3a6ff]" />
              <span className="font-label text-xs font-semibold text-on-surface uppercase tracking-widest">
                {deliveries.length} {deliveries.length === 1 ? 'Operation' : 'Operations'} Live
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest">
              Loading deliveries...
            </span>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="bg-surface-container rounded-xl border border-outline-variant/10 px-8 py-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface-container-highest flex items-center justify-center text-primary mb-4">
              <span className="material-symbols-outlined">inbox</span>
            </div>
            <h3 className="font-headline font-bold text-lg text-on-surface">No deliveries yet</h3>
            <p className="text-sm text-on-surface-variant mt-2 max-w-md">
              Once you create a delivery request it will appear here in real time.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-6 bg-primary text-on-primary px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
            >
              New Delivery
            </button>
          </div>
        ) : (
          /* Bento Grid for Shipments */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deliveries.map((shipment, idx) => {
              const statusKey = (shipment.status ?? 'requested').toLowerCase()
              const statusMeta =
                ACTIVE_STATUS_LABELS[statusKey] ?? {
                  label: statusKey.replace(/_/g, ' '),
                  cls: 'bg-surface-container-highest text-on-surface-variant',
                }
              const trackingId = formatTrackingId(shipment)
              const driverInitial = shipment.driver_id
                ? shipment.driver_id.slice(0, 2).toUpperCase()
                : 'NA'
              const driverBg = DRIVER_BG_PALETTE[idx % DRIVER_BG_PALETTE.length]

              return (
                <div
                  key={shipment.id}
                  className="bg-surface-container rounded-xl overflow-hidden group transition-all duration-300 hover:bg-surface-container-high relative border border-transparent hover:border-primary/10"
                >
                  <div className="absolute top-0 right-0 p-4">
                    <span
                      className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${statusMeta.cls}`}
                    >
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
                          <p className="text-[10px] text-on-surface-variant uppercase font-semibold">
                            Pickup
                          </p>
                          <p className="text-on-surface font-headline font-bold truncate">
                            {formatRoute(shipment.pickup_address)}
                          </p>
                        </div>
                      </div>
                      <div className="ml-5 h-6 border-l-2 border-dashed border-outline-variant" />
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-secondary">
                          <span className="material-symbols-outlined">flag</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-on-surface-variant uppercase font-semibold">
                            Destination
                          </p>
                          <p className="text-on-surface font-headline font-bold truncate">
                            {formatRoute(shipment.delivery_address)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-outline-variant/10">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full ${driverBg} flex items-center justify-center text-[10px] font-bold text-on-primary`}
                        >
                          {driverInitial}
                        </div>
                        <div className="text-xs">
                          <p className="text-on-surface font-medium">
                            {shipment.driver_id ? 'Driver assigned' : 'Awaiting driver'}
                          </p>
                          <p className="text-on-surface-variant">
                            {shipment.created_at
                              ? new Date(shipment.created_at).toLocaleDateString()
                              : ''}
                          </p>
                        </div>
                      </div>
                      <button className="bg-primary text-on-primary px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(163,166,255,0.2)]">
                        Track
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}
