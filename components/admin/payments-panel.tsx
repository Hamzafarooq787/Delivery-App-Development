"use client"

import { useState, useMemo } from "react"

// ─────────── Types ────────────────────────────────────────────────────────────

// delivery_requests row enriched with customer name/email
type EnrichedDelivery = {
  id: string
  tracking_number: string | null
  price: number | null
  status: string   // delivery status: requested | accepted | collected | in_transit | delivered | cancelled
  created_at: string
  customer_id: string | null
  customer_name: string | null
  customer_email: string | null
}

type EnrichedPayout = {
  id: string
  amount: number | null
  status: string   // payout status: pending | paid
  created_at: string
  driver_id: string | null
  driver_name: string | null
  driver_email: string | null
}

type Earning = {
  amount: number | null
  commission_amount: number | null
}

type TxRow = {
  id: string
  type: "delivery" | "payout"
  shortLabel: string
  userName: string
  userEmail: string
  amount: number
  paymentStatus: "paid" | "pending" | "failed"
  rawDate: string
  trackingNumber?: string
}

// ─────────── Constants ────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["All", "Paid", "Pending", "Failed"] as const
const DATE_OPTIONS   = ["All Time", "Last 7 Days", "Last 30 Days"] as const
type StatusFilter    = (typeof STATUS_OPTIONS)[number]
type DateFilter      = (typeof DATE_OPTIONS)[number]

const STATUS_CFG = {
  paid:    { label: "Paid",    dot: "bg-[#a3a6ff] shadow-[0_0_6px_rgba(163,166,255,0.6)]", bg: "bg-[#a3a6ff]/10", text: "text-[#a3a6ff]" },
  pending: { label: "Pending", dot: "bg-[#c180ff] animate-pulse",                           bg: "bg-[#c180ff]/10", text: "text-[#c180ff]" },
  failed:  { label: "Failed",  dot: "bg-[#ff6e84]",                                         bg: "bg-[#ff6e84]/10", text: "text-[#ff6e84]" },
} as const

// ─────────── Helpers ──────────────────────────────────────────────────────────

/** Map a delivery_requests.status → a payment-context status */
function toPaymentStatus(deliveryStatus: string): "paid" | "pending" | "failed" {
  if (deliveryStatus === "delivered") return "paid"
  if (deliveryStatus === "cancelled") return "failed"
  return "pending"
}

function fmt(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function monogram(name: string | null, email: string | null) {
  return (name ?? email ?? "??").slice(0, 2).toUpperCase()
}

// ─────────── Component ────────────────────────────────────────────────────────

export function PaymentsPanel({
  deliveries,
  payouts,
  earnings,
  deliveredPrices,
}: {
  deliveries: EnrichedDelivery[]
  payouts: EnrichedPayout[]
  earnings: Earning[]
  deliveredPrices: { price: number | null }[]
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All")
  const [dateFilter,   setDateFilter]   = useState<DateFilter>("All Time")
  const [selectedTx,   setSelectedTx]   = useState<TxRow | null>(null)

  // ── Summary cards — IDENTICAL logic to Admin Overview ─────────────────────
  const totalDriverEarnings = earnings.reduce((s, e) => s + (e.amount          ?? 0), 0)
  const totalCommission     = earnings.reduce((s, e) => s + (e.commission_amount ?? 0), 0)
  const grossFromEarnings   = totalDriverEarnings + totalCommission

  // Fallback: sum of delivered delivery_requests.price (same as Overview fallback)
  const deliveredTotal     = deliveredPrices.reduce((s, d) => s + (d.price ?? 0), 0)
  const grossRevenue       = grossFromEarnings > 0 ? grossFromEarnings : deliveredTotal
  const platformCommission = grossFromEarnings > 0
    ? totalCommission
    : Math.round(deliveredTotal * 0.25 * 100) / 100
  const driverEarnings = grossFromEarnings > 0
    ? totalDriverEarnings
    : Math.round(deliveredTotal * 0.75 * 100) / 100

  const pendingPayoutsCount = payouts.filter(p => p.status === "pending").length
  // "Failed charges" = cancelled deliveries that had a price attached
  const failedAmount = deliveries
    .filter(d => d.status === "cancelled" && d.price != null)
    .reduce((s, d) => s + (d.price ?? 0), 0)

  // ── Build unified transaction rows ─────────────────────────────────────────
  const allTxs = useMemo<TxRow[]>(() => {
    const deliveryRows: TxRow[] = deliveries.map(d => ({
      id:            d.id,
      type:          "delivery",
      shortLabel:    d.tracking_number ?? d.id.slice(0, 8).toUpperCase(),
      userName:      d.customer_name  ?? "Unknown Customer",
      userEmail:     d.customer_email ?? "—",
      amount:        d.price ?? 0,
      paymentStatus: toPaymentStatus(d.status),
      rawDate:       d.created_at,
      trackingNumber: d.tracking_number ?? undefined,
    }))
    const payoutRows: TxRow[] = payouts.map(p => ({
      id:            p.id,
      type:          "payout",
      shortLabel:    p.id.slice(0, 8).toUpperCase(),
      userName:      p.driver_name  ?? "Unknown Driver",
      userEmail:     p.driver_email ?? "—",
      amount:        p.amount ?? 0,
      paymentStatus: p.status === "paid" ? "paid" : "pending",
      rawDate:       p.created_at,
    }))
    return [...deliveryRows, ...payoutRows].sort(
      (a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime(),
    )
  }, [deliveries, payouts])

  // ── Apply filters ──────────────────────────────────────────────────────────
  const filteredTxs = useMemo(() => {
    const now = Date.now()
    return allTxs.filter(tx => {
      if (statusFilter !== "All" && tx.paymentStatus !== statusFilter.toLowerCase()) return false
      if (dateFilter === "Last 7 Days"  && new Date(tx.rawDate).getTime() < now - 7  * 86_400_000) return false
      if (dateFilter === "Last 30 Days" && new Date(tx.rawDate).getTime() < now - 30 * 86_400_000) return false
      return true
    })
  }, [allTxs, statusFilter, dateFilter])

  // ── CSV export of visible rows ─────────────────────────────────────────────
  function handleExportCSV() {
    const header = "ID,Type,Name,Email,Amount (£),Status,Date\n"
    const body = filteredTxs
      .map(tx => [
        `#${tx.id.slice(0, 8).toUpperCase()}`,
        tx.type,
        `"${tx.userName}"`,
        `"${tx.userEmail}"`,
        tx.amount.toFixed(2),
        tx.paymentStatus,
        `"${new Date(tx.rawDate).toLocaleString("en-GB")}"`,
      ].join(","))
      .join("\n")
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement("a"), {
      href: url,
      download: `transactions-${new Date().toISOString().slice(0, 10)}.csv`,
    })
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtersActive = statusFilter !== "All" || dateFilter !== "All Time"

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[#131313]">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 md:mb-8">
        <div>
          <h3 className="text-2xl font-bold font-headline text-white mb-1">Transactions</h3>
          <p className="text-[#adaaaa] text-sm">Detailed log of all financial movements.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">

          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="appearance-none bg-[#1a1919] px-3 py-2 pr-7 rounded-lg border border-[#494847]/20 text-sm text-white cursor-pointer focus:outline-none focus:border-[#a3a6ff]/40 transition-colors"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s} className="bg-[#1a1919]">
                  {s === "All" ? "Status: All" : s}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm text-[#adaaaa]">
              expand_more
            </span>
          </div>

          {/* Date filter */}
          <div className="relative">
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as DateFilter)}
              className="appearance-none bg-[#1a1919] px-3 py-2 pr-7 rounded-lg border border-[#494847]/20 text-sm text-white cursor-pointer focus:outline-none focus:border-[#a3a6ff]/40 transition-colors"
            >
              {DATE_OPTIONS.map(d => (
                <option key={d} value={d} className="bg-[#1a1919]">{d}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm text-[#adaaaa]">
              expand_more
            </span>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-[#262626] hover:bg-[#2c2c2c] px-4 py-2 rounded-lg transition-colors text-sm font-semibold text-white"
          >
            <span className="material-symbols-outlined text-sm text-[#a3a6ff]">download</span>
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Summary Bento ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-6 mb-6 md:mb-8">

        {/* Gross Revenue */}
        <div className="sm:col-span-2 lg:col-span-5 bg-[#1a1919] p-6 md:p-8 rounded-xl relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="z-10">
            <p className="text-[#adaaaa] text-sm font-medium mb-1">Gross Revenue (All Time)</p>
            <h2 className="text-3xl md:text-5xl font-extrabold text-[#a3a6ff] font-headline tracking-tight">
              {fmt(grossRevenue)}
            </h2>
          </div>
          <div className="z-10">
            <p className="text-[#adaaaa] text-sm">
              {allTxs.length} total transaction{allTxs.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-[#a3a6ff]/10 to-transparent pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-[#a3a6ff]/5 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Commission split */}
        <div className="col-span-1 lg:col-span-4 space-y-4">
          <div className="bg-[#1a1919] px-6 py-5 rounded-xl flex items-center justify-between border-l-4 border-[#c180ff]">
            <div>
              <p className="text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold mb-1">Platform Commission (25%)</p>
              <h3 className="text-2xl font-bold text-[#c180ff] font-headline">{fmt(platformCommission)}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#c180ff]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#c180ff]">account_balance</span>
            </div>
          </div>
          <div className="bg-[#1a1919] px-6 py-5 rounded-xl flex items-center justify-between border-l-4 border-[#6ee7b7]">
            <div>
              <p className="text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold mb-1">Driver Earnings (75%)</p>
              <h3 className="text-2xl font-bold text-[#6ee7b7] font-headline">{fmt(driverEarnings)}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#6ee7b7]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#6ee7b7]">local_shipping</span>
            </div>
          </div>
        </div>

        {/* Secondary stats */}
        <div className="col-span-1 lg:col-span-3 space-y-4">
          <div className="bg-[#1a1919] p-6 rounded-xl flex flex-col justify-center" style={{ minHeight: "76px" }}>
            <p className="text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold mb-1">Pending Payouts</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-white font-headline">{pendingPayoutsCount}</h3>
              <span className="text-xs text-[#adaaaa]">awaiting</span>
            </div>
          </div>
          <div className="bg-[#1a1919] p-6 rounded-xl flex flex-col justify-center" style={{ minHeight: "76px" }}>
            <p className="text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold mb-1">Cancelled Charges</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-[#ff6e84] font-headline">{fmt(failedAmount)}</h3>
              <span className="text-xs text-[#adaaaa]">cancelled</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Transactions Table ─────────────────────────────────────────────── */}
      <div className="bg-[#1a1919] rounded-xl overflow-hidden shadow-2xl">

        {/* Active filter banner */}
        {filtersActive && (
          <div className="px-5 md:px-8 py-3 bg-[#1e1e1e] border-b border-[#494847]/10 flex items-center gap-3">
            <span className="text-xs text-[#adaaaa]">
              Showing{" "}
              <span className="text-white font-bold">{filteredTxs.length}</span> of{" "}
              <span className="text-white font-bold">{allTxs.length}</span> transactions
            </span>
            <button
              onClick={() => { setStatusFilter("All"); setDateFilter("All Time") }}
              className="text-xs text-[#a3a6ff] hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left border-collapse">
            <thead>
              <tr className="bg-[#201f1f] text-[#adaaaa] text-[10px] uppercase tracking-[0.2em] font-bold">
                <th className="px-5 md:px-8 py-4">Payment ID</th>
                <th className="px-5 md:px-8 py-4">User / Recipient</th>
                <th className="px-5 md:px-8 py-4">Amount</th>
                <th className="px-5 md:px-8 py-4">Status</th>
                <th className="px-5 md:px-8 py-4">Date &amp; Time</th>
                <th className="px-5 md:px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#494847]/5">
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#262626] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#adaaaa]">payments</span>
                      </div>
                      <p className="text-sm font-bold text-white">No transactions found</p>
                      <p className="text-xs text-[#adaaaa]">
                        {filtersActive
                          ? "Try adjusting your filters"
                          : "No delivery or payout records yet"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTxs.map(tx => (
                  <TxTableRow
                    key={`${tx.type}-${tx.id}`}
                    tx={tx}
                    onSelect={() => setSelectedTx(tx)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail modal ──────────────────────────────────────────────────── */}
      {selectedTx && (
        <TxDetailModal tx={selectedTx} onClose={() => setSelectedTx(null)} />
      )}
    </div>
  )
}

// ─────────── Table row ────────────────────────────────────────────────────────

function TxTableRow({ tx, onSelect }: { tx: TxRow; onSelect: () => void }) {
  const cfg     = STATUS_CFG[tx.paymentStatus]
  const shortId = `#${tx.id.slice(0, 8).toUpperCase()}`
  const dateObj = new Date(tx.rawDate)
  const dateStr = dateObj.toLocaleDateString("en-GB",  { month: "short", day: "numeric", year: "numeric" })
  const timeStr = dateObj.toLocaleTimeString("en-GB",  { hour: "2-digit", minute: "2-digit" })

  return (
    <tr className="hover:bg-[#201f1f] transition-all group">
      <td className="px-5 md:px-8 py-4 md:py-5">
        <div>
          <span className="font-mono text-xs text-[#a3a6ff]">{shortId}</span>
          <p className="text-[10px] text-[#adaaaa] mt-0.5 capitalize">
            {tx.type === "delivery" ? "delivery payment" : "driver payout"}
          </p>
        </div>
      </td>
      <td className="px-5 md:px-8 py-4 md:py-5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[#262626] flex items-center justify-center text-[#a3a6ff] font-bold text-xs shrink-0">
            {monogram(tx.userName, tx.userEmail)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{tx.userName}</p>
            <p className="text-[10px] text-[#adaaaa] truncate">{tx.userEmail}</p>
          </div>
        </div>
      </td>
      <td className="px-5 md:px-8 py-4 md:py-5">
        <span className="text-sm font-bold text-white">{fmt(tx.amount)}</span>
      </td>
      <td className="px-5 md:px-8 py-4 md:py-5">
        <span
          className={`px-2 py-1 ${cfg.bg} ${cfg.text} text-[10px] font-bold uppercase rounded tracking-wider flex items-center w-fit gap-1`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </td>
      <td className="px-5 md:px-8 py-4 md:py-5 text-sm text-[#adaaaa]">
        {dateStr}{" "}
        <span className="text-[10px] opacity-50 ml-1">{timeStr}</span>
      </td>
      <td className="px-5 md:px-8 py-4 md:py-5 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onSelect}
            title="View details"
            className="w-7 h-7 rounded-lg bg-[#262626] hover:bg-[#2c2c2c] flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-sm text-[#adaaaa]">open_in_new</span>
          </button>
          {tx.trackingNumber && (
            <a
              href={`/dashboard/admin/orders?tracking=${tx.trackingNumber}`}
              title="View delivery"
              className="w-7 h-7 rounded-lg bg-[#262626] hover:bg-[#2c2c2c] flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-sm text-[#a3a6ff]">local_shipping</span>
            </a>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─────────── Detail modal ─────────────────────────────────────────────────────

function TxDetailModal({ tx, onClose }: { tx: TxRow; onClose: () => void }) {
  const cfg = STATUS_CFG[tx.paymentStatus]
  const dateStr = new Date(tx.rawDate).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 bg-[#1a1919] border border-[#494847]/20 rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#adaaaa] mb-0.5">
              {tx.type === "delivery" ? "Delivery Payment" : "Driver Payout"}
            </p>
            <h3 className="text-lg font-bold text-white font-headline">
              #{tx.id.slice(0, 8).toUpperCase()}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#262626] flex items-center justify-center hover:bg-[#2c2c2c] transition-colors"
          >
            <span className="material-symbols-outlined text-sm text-[#adaaaa]">close</span>
          </button>
        </div>

        {/* Amount + status */}
        <div className="bg-[#262626] rounded-xl p-5 mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#adaaaa] uppercase tracking-widest mb-1">Amount</p>
            <p className="text-3xl font-black text-white font-headline">{fmt(tx.amount)}</p>
          </div>
          <span
            className={`px-3 py-1.5 ${cfg.bg} ${cfg.text} text-xs font-bold uppercase rounded-lg tracking-wider flex items-center gap-1.5`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        {/* Detail rows */}
        <div className="space-y-0">
          <DetailRow label={tx.type === "delivery" ? "Customer" : "Driver"} value={tx.userName} />
          <DetailRow label="Email" value={tx.userEmail} />
          <DetailRow label="Date"  value={dateStr} />
          {tx.trackingNumber && (
            <div className="flex items-center justify-between py-2.5 border-b border-[#494847]/10">
              <span className="text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold">
                Delivery
              </span>
              <a
                href={`/dashboard/admin/orders?tracking=${tx.trackingNumber}`}
                className="text-xs text-[#a3a6ff] hover:underline font-mono"
              >
                {tx.trackingNumber}
              </a>
            </div>
          )}
          <DetailRow label="Full ID" value={tx.id} mono />
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          {tx.trackingNumber && (
            <a
              href={`/dashboard/admin/orders?tracking=${tx.trackingNumber}`}
              className="flex-1 flex items-center justify-center gap-2 bg-[#a3a6ff]/10 hover:bg-[#a3a6ff]/20 text-[#a3a6ff] text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              <span className="material-symbols-outlined text-sm">local_shipping</span>
              View Delivery
            </a>
          )}
          <button
            onClick={onClose}
            className="flex-1 bg-[#262626] hover:bg-[#2c2c2c] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-[#494847]/10">
      <span className="text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold shrink-0 mr-4 pt-0.5">
        {label}
      </span>
      <span className={`text-xs text-white text-right break-all ${mono ? "font-mono text-[#a3a6ff]" : "font-medium"}`}>
        {value}
      </span>
    </div>
  )
}
