'use client'

import { useEffect, useMemo, useState } from 'react'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'
import { createClient } from '@/lib/supabase/client'

type DeliveryRow = {
  id: string
  tracking_number: string | null
  customer_id: string | null
  pickup_address: string | null
  delivery_address: string | null
  item_description: string | null
  price: number | null
  status: string | null
  created_at: string | null
}

function formatTrackingId(d: DeliveryRow) {
  if (d.tracking_number) return `#${d.tracking_number}`
  return `#KV-${d.id.slice(0, 8).toUpperCase()}`
}

function formatDate(iso: string | null) {
  if (!iso) return { date: '—', time: '' }
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }) + ' UTC',
  }
}

function formatPrice(price: number | null) {
  if (price == null) return '—'
  return price.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
  })
}

export default function DeliveryHistoryPage() {
  const [showModal, setShowModal] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [rows, setRows] = useState<DeliveryRow[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = useMemo(() => createClient(), [])

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
          setRows([])
          setLoading(false)
        }
        return
      }

      if (!cancelled) setUserId(user.id)

      const { data, error } = await supabase
        .from('delivery_requests')
        .select(
          'id, tracking_number, customer_id, pickup_address, delivery_address, item_description, price, status, created_at'
        )
        .eq('customer_id', user.id)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (error) {
        console.error('[v0] history fetch error', error)
        setRows([])
      } else {
        setRows((data ?? []) as DeliveryRow[])
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  // Realtime: when a delivery transitions to delivered, surface it here
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`customer-history-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_requests',
          filter: `customer_id=eq.${userId}`,
        },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as DeliveryRow
              if (row.status !== 'delivered') return prev
              if (prev.some((r) => r.id === row.id)) return prev
              return [row, ...prev]
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as DeliveryRow
              const next = prev.filter((r) => r.id !== row.id)
              if (row.status === 'delivered') {
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
      <main className="pt-24 pb-12 md:ml-64 px-8 min-h-screen bg-surface-container-low">
        {/* Header Section */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-4xl font-extrabold font-headline tracking-tighter text-on-surface">
              Shipment History
            </h2>
            <p className="text-on-surface-variant mt-2 font-medium text-sm">
              {loading
                ? 'Loading completed transits...'
                : `Tracking ${rows.length.toLocaleString()} completed ${
                    rows.length === 1 ? 'transit' : 'transits'
                  } within the Kinetic Void.`}
            </p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-highest border border-outline-variant/20 rounded-lg text-sm font-medium hover:bg-surface-container transition-colors text-on-surface">
              <span className="material-symbols-outlined text-sm">calendar_today</span>
              Last 30 Days
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-highest border border-outline-variant/20 rounded-lg text-sm font-medium hover:bg-surface-container transition-colors text-on-surface">
              <span className="material-symbols-outlined text-sm">filter_list</span>
              All Statuses
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-highest hover:bg-surface-container-high transition-colors text-primary rounded-lg text-sm font-bold border border-primary/20">
              <span className="material-symbols-outlined text-sm">download</span>
              Export CSV
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className="glass-card rounded-2xl overflow-hidden border border-outline-variant/10 shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-lowest/30">
                {['Waybill ID', 'Timeline', 'Route (Pickup → Drop)', 'Value', 'Status', ''].map(
                  (col) => (
                    <th
                      key={col}
                      className={`px-6 py-5 text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant font-headline ${
                        col === 'Status' ? 'text-center' : ''
                      }`}
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest">
                      Loading shipments...
                    </span>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="w-14 h-14 rounded-2xl bg-surface-container-highest flex items-center justify-center text-primary mb-4">
                        <span className="material-symbols-outlined">history</span>
                      </div>
                      <h3 className="font-headline font-bold text-lg text-on-surface">
                        No deliveries yet
                      </h3>
                      <p className="text-sm text-on-surface-variant mt-2 max-w-md">
                        Completed deliveries will be archived here once they are marked delivered.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const tracking = formatTrackingId(row)
                  const { date, time } = formatDate(row.created_at)
                  return (
                    <tr
                      key={row.id}
                      className="group hover:bg-primary/5 transition-all cursor-pointer"
                    >
                      <td className="px-6 py-5">
                        <span className="text-sm font-bold text-primary font-headline">
                          {tracking}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm text-on-surface font-medium">{date}</p>
                        <p className="text-[10px] text-on-surface-variant">{time}</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(163,166,255,0.6)]" />
                            <div className="w-[1px] h-4 border-l border-dashed border-outline-variant my-0.5" />
                            <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(193,128,255,0.6)]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-on-surface truncate max-w-[18rem]">
                              {row.pickup_address ?? '—'}
                            </p>
                            <p className="text-xs font-semibold text-on-surface mt-1.5 truncate max-w-[18rem]">
                              {row.delivery_address ?? '—'}
                            </p>
                            {row.item_description && (
                              <p className="text-[10px] text-on-surface-variant mt-1 truncate max-w-[18rem]">
                                {row.item_description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm font-bold text-on-surface">
                          {formatPrice(row.price)}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold border uppercase tracking-tighter bg-primary/10 text-primary border-primary/20">
                          <span className="w-1 h-1 rounded-full bg-primary mr-1.5 animate-pulse" />
                          Delivered
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">
                          arrow_forward_ios
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          {/* Pagination Footer */}
          {!loading && rows.length > 0 && (
            <div className="px-6 py-6 flex items-center justify-between bg-surface-container-highest/20">
              <div className="text-xs font-medium text-on-surface-variant">
                Showing{' '}
                <span className="text-on-surface">1-{Math.min(rows.length, 10)}</span> of{' '}
                <span className="text-on-surface">{rows.length.toLocaleString()}</span> shipments
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 text-xs font-bold bg-surface-container-highest/50 text-on-surface-variant rounded-lg border border-outline-variant/10 hover:bg-surface-container-high transition-colors">
                  Previous
                </button>
                <button className="px-4 py-2 text-xs font-bold rounded-lg border bg-primary text-on-primary border-primary">
                  1
                </button>
                <button className="px-4 py-2 text-xs font-bold bg-surface-container-highest/50 text-on-surface-variant rounded-lg border border-outline-variant/10 hover:bg-surface-container-high transition-colors">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}
