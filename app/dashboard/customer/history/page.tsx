'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'
import { SubTabs } from '@/components/ui/sub-tabs'
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
  delivered_image_url: string | null
}

type DateFilter = 'all' | '30d'

const PAGE_SIZE = 10

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
  return `£${price.toFixed(2)}`
}

function formatRoute(addr: string | null) {
  if (!addr) return 'Unknown'
  return addr.split(',')[0]?.trim() || addr
}

export default function DeliveryHistoryPage() {
  const [showModal, setShowModal] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [rows, setRows] = useState<DeliveryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [page, setPage] = useState(1)

  const router = useRouter()
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
          'id, tracking_number, customer_id, pickup_address, delivery_address, item_description, price, status, created_at, delivered_image_url'
        )
        .eq('customer_id', user.id)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (error) {
        console.error('[history] fetch error', error)
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

  // ── Date filter ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (dateFilter === 'all') return rows
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    return rows.filter((r) => r.created_at && new Date(r.created_at) >= cutoff)
  }, [rows, dateFilter])

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [dateFilter])

  // ── CSV Export ────────────────────────────────────────────────────────────
  function handleExportCSV() {
    const headers = ['Tracking #', 'Date', 'Pickup', 'Delivery', 'Item', 'Price', 'Status']
    const csvRows = filtered.map((r) => [
      r.tracking_number ?? `KV-${r.id.slice(0, 8).toUpperCase()}`,
      r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : '',
      r.pickup_address ?? '',
      r.delivery_address ?? '',
      r.item_description ?? '',
      r.price?.toFixed(2) ?? '',
      r.status ?? 'delivered',
    ])
    const csv = [headers, ...csvRows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `delivery-history-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} />
      <main className="pt-16 pb-28 md:pb-8 px-4 md:px-8 md:ml-64 min-h-screen bg-surface-container-low">

        {/* Page header */}
        <div className="pt-5 md:pt-8 mb-6 md:mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="font-headline text-2xl md:text-4xl font-extrabold tracking-tight text-on-surface">
              Shipments
            </h2>
            <SubTabs
              className="mt-4"
              tabs={[
                { label: 'Active',  href: '/dashboard/customer/active-deliveries', icon: 'local_shipping' },
                { label: 'History', href: '/dashboard/customer/history',           icon: 'history' },
              ]}
            />
            <p className="text-on-surface-variant mt-3 text-sm">
              {loading
                ? 'Loading completed transits...'
                : `${filtered.length.toLocaleString()} completed ${filtered.length === 1 ? 'transit' : 'transits'}`}
            </p>
          </div>
          {/* Filter controls */}
          <div className="flex gap-3 flex-wrap">
            {/* Date filter toggle */}
            <div className="flex bg-surface-container border border-outline-variant/20 rounded-lg p-1">
              <button
                onClick={() => setDateFilter('30d')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  dateFilter === '30d'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-sm">calendar_today</span>
                Last 30 Days
              </button>
              <button
                onClick={() => setDateFilter('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  dateFilter === 'all'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                All Time
              </button>
            </div>
            <button
              onClick={handleExportCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container-highest hover:bg-surface-container-high transition-colors text-primary rounded-lg text-sm font-bold border border-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-container animate-pulse" />
            <span className="text-xs text-on-surface-variant uppercase tracking-widest">Loading…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-surface-container rounded-2xl border border-outline-variant/10 px-6 py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-container-highest flex items-center justify-center text-primary mb-4">
              <span className="material-symbols-outlined text-2xl">history</span>
            </div>
            <h3 className="font-headline font-bold text-lg text-on-surface">No deliveries yet</h3>
            <p className="text-sm text-on-surface-variant mt-2 max-w-xs">
              Completed deliveries will appear here once marked delivered.
            </p>
          </div>
        ) : (
          <>
            {/* ── MOBILE: native list ── */}
            <div className="md:hidden bg-surface-container rounded-2xl overflow-hidden border border-outline-variant/10">
              {filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-on-surface-variant">No deliveries in the last 30 days.</p>
              ) : (
                pageRows.map((row) => {
                  const tracking = formatTrackingId(row)
                  const { date } = formatDate(row.created_at)
                  return (
                    <div
                      key={row.id}
                      className="flex items-center gap-4 px-4 py-4 border-b border-outline-variant/8 last:border-b-0 active:bg-surface-container-high transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/customer/tracking?id=${row.id}`)}
                    >
                      {/* Icon */}
                      <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                          local_shipping
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-on-surface font-mono">{tracking}</p>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            Delivered
                          </span>
                          {row.delivered_image_url && (
                            <span className="material-symbols-outlined text-primary text-sm" title="Proof of delivery photo available">
                              photo_camera
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-on-surface-variant truncate">
                          {formatRoute(row.pickup_address)} → {formatRoute(row.delivery_address)}
                        </p>
                        <p className="text-[10px] text-on-surface-variant/70 truncate mt-0.5">{date} · {formatPrice(row.price)}</p>
                      </div>

                      <span className="material-symbols-outlined text-on-surface-variant/40 text-lg shrink-0">chevron_right</span>
                    </div>
                  )
                })
              )}
            </div>

            {/* ── DESKTOP: full table ── */}
            <div className="hidden md:block glass-card rounded-2xl overflow-hidden border border-outline-variant/10 shadow-2xl">
              {filtered.length === 0 ? (
                <div className="py-16 text-center text-sm text-on-surface-variant">No deliveries in the last 30 days.</div>
              ) : (
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
                    {pageRows.map((row) => {
                      const tracking = formatTrackingId(row)
                      const { date, time } = formatDate(row.created_at)
                      return (
                        <tr
                          key={row.id}
                          className="group hover:bg-primary/5 transition-all cursor-pointer"
                          onClick={() => router.push(`/dashboard/customer/tracking?id=${row.id}`)}
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
                                <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--brand-rgb),0.6)]" />
                                <div className="w-[1px] h-4 border-l border-dashed border-outline-variant my-0.5" />
                                <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(var(--brand-rgb),0.6)]" />
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
                            <div className="flex items-center justify-center gap-2">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold border uppercase tracking-tighter bg-primary/10 text-primary border-primary/20">
                                <span className="w-1 h-1 rounded-full bg-primary mr-1.5 animate-pulse" />
                                Delivered
                              </span>
                              {row.delivered_image_url && (
                                <span className="material-symbols-outlined text-primary text-sm" title="Proof of delivery photo available">
                                  photo_camera
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">
                              arrow_forward_ios
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {filtered.length > 0 && (
                <div className="px-6 py-6 flex items-center justify-between bg-surface-container-highest/20">
                  <div className="text-xs font-medium text-on-surface-variant">
                    Showing{' '}
                    <span className="text-on-surface">{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}</span> of{' '}
                    <span className="text-on-surface">{filtered.length.toLocaleString()}</span> shipments
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      className="px-4 py-2 text-xs font-bold bg-surface-container-highest/50 text-on-surface-variant rounded-lg border border-outline-variant/10 hover:bg-surface-container-high transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const pg = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(safePage - 2, totalPages - 4)) + i
                      return (
                        <button
                          key={pg}
                          onClick={() => setPage(pg)}
                          className={`px-4 py-2 text-xs font-bold rounded-lg border transition-colors ${
                            pg === safePage
                              ? 'bg-primary text-on-primary border-primary'
                              : 'bg-surface-container-highest/50 text-on-surface-variant border-outline-variant/10 hover:bg-surface-container-high'
                          }`}
                        >
                          {pg}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      className="px-4 py-2 text-xs font-bold bg-surface-container-highest/50 text-on-surface-variant rounded-lg border border-outline-variant/10 hover:bg-surface-container-high transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}

