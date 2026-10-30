"use client"

import { useState, useMemo, useTransition, useEffect } from "react"
import { toast } from "sonner"
import {
  approveDriverPayout,
  rejectDriverPayout,
  completeDriverPayout,
  adminProcessDriverPayout,
  getDriverPayoutDetails,
} from "@/app/actions/payouts"
import { ProcessPayoutButton, ProcessAllButton } from "@/components/admin/process-payout-buttons"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EnrichedPayout = {
  id: string
  driver_id: string
  amount: number
  status: "pending" | "approved" | "rejected" | "paid"
  created_at: string
  driver: { full_name: string; email: string; phone: string | null }
  driverStats: { totalEarned: number; pendingEarnings: number; completedDeliveries: number }
}

export type PendingDriver = {
  driverId: string
  full_name: string
  email: string
  phone: string | null
  pending: number
  total: number
  jobs: number
}

export type KPIStats = {
  pendingRequestCount: number
  pendingAmount: number
  totalPaidOut: number
  driversAwaiting: number
  platformCommission: number
  totalPayoutCount: number
}

export interface AdminPayoutsPanelProps {
  payouts: EnrichedPayout[]
  pendingDrivers: PendingDriver[]
  stats: KPIStats
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ["All", "Pending", "Approved", "Paid", "Rejected"] as const
const DATE_FILTERS   = ["All Time", "Last 7 Days", "Last 30 Days", "Last 90 Days"] as const
type StatusFilter    = (typeof STATUS_FILTERS)[number]
type DateFilter      = (typeof DATE_FILTERS)[number]

const STATUS_CFG = {
  pending:  { label: "Pending",  bg: "bg-[#fbbf24]/10", text: "text-[#fbbf24]", dot: "bg-[#fbbf24] animate-pulse" },
  approved: { label: "Approved", bg: "bg-[#60a5fa]/10", text: "text-[#60a5fa]", dot: "bg-[#60a5fa]" },
  paid:     { label: "Paid",     bg: "bg-[#6ee7b7]/10", text: "text-[#6ee7b7]", dot: "bg-[#6ee7b7]" },
  rejected: { label: "Rejected", bg: "bg-[#ff6e84]/10", text: "text-[#ff6e84]", dot: "bg-[#ff6e84]" },
} as const

function fmt(n: number) { return `£${n.toFixed(2)}` }
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })
}
function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "??"
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────────────────────
function KPICard({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className={`bg-[var(--brand-panel)] p-6 rounded-xl border-l-4 ${accent}`}>
      <p className="text-[var(--color-on-surface-variant)] text-[10px] uppercase tracking-widest font-bold mb-2">{label}</p>
      <p className="text-2xl font-black font-headline text-white">{value}</p>
      {sub && <p className="text-xs text-[var(--color-on-surface-variant)] mt-1">{sub}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.pending
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Action buttons (Approve / Reject / Mark Paid)
// ─────────────────────────────────────────────────────────────────────────────
function PayoutActionButtons({
  payout,
  onDone,
}: { payout: EnrichedPayout; onDone: () => void }) {
  const [isPending, startTransition] = useTransition()

  function run(
    fn: () => Promise<{ error?: string; success?: boolean }>,
    successMsg: string,
  ) {
    startTransition(async () => {
      const res = await fn()
      if (res.error) { toast.error(res.error); return }
      toast.success(successMsg)
      onDone()
    })
  }

  if (payout.status === "pending") {
    return (
      <div className="flex items-center gap-2">
        <button
          disabled={isPending}
          onClick={() => run(() => approveDriverPayout(payout.id), "Payout approved")}
          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#60a5fa]/10 text-[#60a5fa] hover:bg-[#60a5fa]/20 border border-[#60a5fa]/20 transition-all disabled:opacity-50 whitespace-nowrap"
        >
          {isPending ? "…" : "Approve"}
        </button>
        <button
          disabled={isPending}
          onClick={() => run(() => rejectDriverPayout(payout.id), "Payout rejected")}
          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#ff6e84]/10 text-[#ff6e84] hover:bg-[#ff6e84]/20 border border-[#ff6e84]/20 transition-all disabled:opacity-50 whitespace-nowrap"
        >
          {isPending ? "…" : "Reject"}
        </button>
      </div>
    )
  }

  if (payout.status === "approved") {
    return (
      <div className="flex items-center gap-2">
        <button
          disabled={isPending}
          onClick={() => run(() => completeDriverPayout(payout.id, window.prompt("Enter the verified bank payment reference. Only confirm after the transfer is complete.") ?? undefined), fmt(payout.amount) + " disbursed")}
          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#6ee7b7]/10 text-[#6ee7b7] hover:bg-[#6ee7b7]/20 border border-[#6ee7b7]/20 transition-all disabled:opacity-50 whitespace-nowrap"
        >
          {isPending ? "…" : "Mark Paid"}
        </button>
        <button
          disabled={isPending}
          onClick={() => run(() => rejectDriverPayout(payout.id), "Payout rejected")}
          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#ff6e84]/10 text-[#ff6e84] hover:bg-[#ff6e84]/20 border border-[#ff6e84]/20 transition-all disabled:opacity-50 whitespace-nowrap"
        >
          {isPending ? "…" : "Reject"}
        </button>
      </div>
    )
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Payout Detail Modal
// ─────────────────────────────────────────────────────────────────────────────
type DetailData = Awaited<ReturnType<typeof getDriverPayoutDetails>>

function PayoutDetailModal({
  payout,
  onClose,
}: { payout: EnrichedPayout; onClose: () => void }) {
  const [details, setDetails] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getDriverPayoutDetails(payout.driver_id).then(d => {
      setDetails(d)
      setLoading(false)
    })
  }, [payout.driver_id])

  const cfg = STATUS_CFG[payout.status] ?? STATUS_CFG.pending

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/20 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[var(--color-outline-variant)]/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--brand-strong)]/10 flex items-center justify-center text-[var(--brand-soft)] font-bold text-base shrink-0">
              {initials(payout.driver.full_name)}
            </div>
            <div>
              <p className="text-white font-bold text-base">{payout.driver.full_name || "Unknown Driver"}</p>
              <p className="text-[var(--color-on-surface-variant)] text-xs">{payout.driver.email}</p>
              {payout.driver.phone && <p className="text-[var(--color-on-surface-variant)] text-xs">{payout.driver.phone}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-on-surface-variant)] hover:text-white transition-colors p-1"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Payout summary */}
        <div className="p-6 border-b border-[var(--color-outline-variant)]/10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[var(--color-on-surface-variant)] text-[10px] uppercase tracking-wider font-bold mb-1">Payout Request</p>
              <p className="text-3xl font-black font-headline text-white">{fmt(payout.amount)}</p>
            </div>
            <StatusBadge status={payout.status} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--color-surface-container-highest)] rounded-xl p-3">
              <p className="text-[var(--color-on-surface-variant)] text-[10px] uppercase tracking-wider font-bold mb-1">Payout ID</p>
              <p className="text-[var(--brand-soft)] font-mono text-xs">#{payout.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div className="bg-[var(--color-surface-container-highest)] rounded-xl p-3">
              <p className="text-[var(--color-on-surface-variant)] text-[10px] uppercase tracking-wider font-bold mb-1">Requested</p>
              <p className="text-white text-xs">{fmtDate(payout.created_at)}</p>
            </div>
            <div className="bg-[var(--color-surface-container-highest)] rounded-xl p-3">
              <p className="text-[var(--color-on-surface-variant)] text-[10px] uppercase tracking-wider font-bold mb-1">Total Earned</p>
              <p className="text-white text-xs font-bold">{fmt(payout.driverStats.totalEarned)}</p>
            </div>
            <div className="bg-[var(--color-surface-container-highest)] rounded-xl p-3">
              <p className="text-[var(--color-on-surface-variant)] text-[10px] uppercase tracking-wider font-bold mb-1">Pending Balance</p>
              <p className={`text-xs font-bold ${payout.driverStats.pendingEarnings > 0 ? "text-[var(--color-secondary)]" : "text-[var(--color-on-surface-variant)]"}`}>
                {fmt(payout.driverStats.pendingEarnings)}
              </p>
            </div>
          </div>
        </div>

        {/* Earnings breakdown */}
        <div className="p-6 border-b border-[var(--color-outline-variant)]/10">
          <p className="text-[var(--color-on-surface-variant)] text-[10px] uppercase tracking-wider font-bold mb-3">Earnings History</p>
          {loading ? (
            <div className="flex items-center gap-2 text-[var(--color-on-surface-variant)] text-sm py-4">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Loading breakdown…
            </div>
          ) : (details?.earnings ?? []).length === 0 ? (
            <p className="text-[var(--color-on-surface-variant)] text-xs py-2">No earnings records found.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {(details?.earnings ?? []).map(e => (
                <div key={e.id} className="flex items-center justify-between bg-[var(--color-surface-container-highest)] rounded-lg px-3 py-2">
                  <div>
                    <p className="text-white text-xs font-semibold">{fmt(e.amount ?? 0)}</p>
                    <p className="text-[var(--color-on-surface-variant)] text-[10px]">{fmtDate(e.created_at)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    e.status === "paid"
                      ? "bg-[#6ee7b7]/10 text-[#6ee7b7]"
                      : "bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]"
                  }`}>
                    {e.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent completed deliveries */}
        <div className="p-6 border-b border-[var(--color-outline-variant)]/10">
          <p className="text-[var(--color-on-surface-variant)] text-[10px] uppercase tracking-wider font-bold mb-3">Recent Completed Deliveries</p>
          {loading ? (
            <p className="text-[var(--color-on-surface-variant)] text-xs py-2">Loading…</p>
          ) : (details?.deliveries ?? []).length === 0 ? (
            <p className="text-[var(--color-on-surface-variant)] text-xs py-2">No completed deliveries on record.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(details?.deliveries ?? []).map(d => (
                <div key={d.id} className="bg-[var(--color-surface-container-highest)] rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[var(--brand-soft)] font-mono text-[10px]">
                      {d.tracking_number ?? `#${d.id.slice(0, 8).toUpperCase()}`}
                    </p>
                    <p className="text-white text-xs font-bold">{fmt(d.price ?? 0)}</p>
                  </div>
                  <p className="text-[var(--color-on-surface-variant)] text-[10px] truncate">{d.pickup_address ?? "—"} → {d.delivery_address ?? "—"}</p>
                  <p className="text-[var(--color-on-surface-variant)] text-[10px] mt-0.5">{fmtDate(d.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payout history for this driver */}
        {!loading && (details?.payoutHistory ?? []).length > 1 && (
          <div className="p-6 border-b border-[var(--color-outline-variant)]/10">
            <p className="text-[var(--color-on-surface-variant)] text-[10px] uppercase tracking-wider font-bold mb-3">Driver Payout History</p>
            <div className="space-y-2">
              {(details?.payoutHistory ?? []).map(p => (
                <div key={p.id} className="flex items-center justify-between bg-[var(--color-surface-container-highest)] rounded-lg px-3 py-2">
                  <div>
                    <p className="text-white text-xs font-semibold">{fmt(p.amount ?? 0)}</p>
                    <p className="text-[var(--color-on-surface-variant)] text-[10px]">{fmtDate(p.created_at)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action footer */}
        {(payout.status === "pending" || payout.status === "approved") && (
          <div className="p-6 flex items-center gap-3">
            <PayoutActionButtons payout={payout} onDone={onClose} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Panel
// ─────────────────────────────────────────────────────────────────────────────
export function AdminPayoutsPanel({ payouts, pendingDrivers, stats }: AdminPayoutsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All")
  const [dateFilter,   setDateFilter]   = useState<DateFilter>("All Time")
  const [selected,     setSelected]     = useState<EnrichedPayout | null>(null)

  const filtered = useMemo(() => {
    const now = Date.now()
    const cutoff: Record<DateFilter, number> = {
      "All Time":    0,
      "Last 7 Days":  now - 7  * 86_400_000,
      "Last 30 Days": now - 30 * 86_400_000,
      "Last 90 Days": now - 90 * 86_400_000,
    }
    return payouts.filter(p => {
      const matchStatus = statusFilter === "All" || p.status === statusFilter.toLowerCase()
      const matchDate   = new Date(p.created_at).getTime() >= cutoff[dateFilter]
      return matchStatus && matchDate
    })
  }, [payouts, statusFilter, dateFilter])

  const pendingCount = payouts.filter(p => p.status === "pending").length

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[var(--brand-bg)]">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Payout Management
          </h2>
          <p className="text-[var(--color-on-surface-variant)] mt-1 text-sm">
            Review, approve, and disburse driver payout requests.
          </p>
        </div>
        {pendingCount > 0 && <ProcessAllButton count={pendingCount} />}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-6 md:mb-8">
        <KPICard
          label="Pending Requests"
          value={String(stats.pendingRequestCount)}
          sub={`${fmt(stats.pendingAmount)} awaiting`}
          accent="border-[#fbbf24]"
        />
        <KPICard
          label="Drivers Awaiting"
          value={String(stats.driversAwaiting)}
          sub="with open requests"
          accent="border-[var(--color-secondary)]"
        />
        <KPICard
          label="Total Paid Out"
          value={fmt(stats.totalPaidOut)}
          sub={`${stats.totalPayoutCount} total requests`}
          accent="border-[#6ee7b7]"
        />
        <KPICard
          label="Platform Commission"
          value={fmt(stats.platformCommission)}
          sub="25% of all fares"
          accent="border-[var(--brand-strong)]"
        />
      </div>

      {/* ── Pending Driver Balances (unclaimed) ── */}
      {pendingDrivers.length > 0 && (
        <div className="bg-[var(--brand-panel)] rounded-xl overflow-hidden mb-6">
          <div className="px-6 py-5 border-b border-[var(--color-outline-variant)]/10 flex items-center justify-between">
            <div>
              <h3 className="font-headline text-base font-bold text-white">Unclaimed Driver Balances</h3>
              <p className="text-xs text-[var(--color-on-surface-variant)] mt-0.5">Earnings available but not yet requested</p>
            </div>
            <span className="text-xs font-bold text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-3 py-1 rounded-full">
              {pendingDrivers.length} drivers
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="bg-[var(--color-surface-container-high)]/50 text-[var(--color-on-surface-variant)] text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4 text-left">Driver</th>
                  <th className="px-6 py-4 text-right">Total Earned</th>
                  <th className="px-6 py-4 text-right">Pending</th>
                  <th className="px-6 py-4 text-right">Jobs</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-outline-variant)]/10">
                {pendingDrivers.map(d => (
                  <tr key={d.driverId} className="hover:bg-[var(--color-surface-container-high)] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--brand-strong)]/10 flex items-center justify-center text-[var(--brand-soft)] text-xs font-bold shrink-0">
                          {initials(d.full_name || d.email)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{d.full_name || "—"}</p>
                          <p className="text-xs text-[var(--color-on-surface-variant)]">{d.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-[var(--color-on-surface-variant)]">{fmt(d.total)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-[var(--color-secondary)]">{fmt(d.pending)}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-[var(--color-on-surface-variant)]">{d.jobs}</td>
                    <td className="px-6 py-4 text-right">
                      <ProcessPayoutButton driverId={d.driverId} amount={d.pending} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Payout Requests Table ── */}
      <div className="bg-[var(--brand-panel)] rounded-xl overflow-hidden">
        {/* Table header + filters */}
        <div className="px-6 py-5 border-b border-[var(--color-outline-variant)]/10 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="font-headline text-base font-bold text-white">Payout Requests</h3>
            <p className="text-xs text-[var(--color-on-surface-variant)] mt-0.5">
              {filtered.length} of {payouts.length} requests
            </p>
          </div>

          {/* Date filter */}
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value as DateFilter)}
            className="bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/20 text-[var(--color-on-surface-variant)] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--brand-strong)]/40 cursor-pointer"
          >
            {DATE_FILTERS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Status filter tabs */}
          <div className="flex bg-[var(--color-surface-container-highest)] p-1 rounded-xl gap-0.5">
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  statusFilter === f
                    ? "bg-[var(--brand-strong)] text-[var(--brand-ink)]"
                    : "text-[var(--color-on-surface-variant)] hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-[var(--color-surface-container-high)]/50 text-[var(--color-on-surface-variant)] text-[10px] uppercase tracking-widest font-bold">
                <th className="px-6 py-4 text-left">Payout ID</th>
                <th className="px-6 py-4 text-left">Driver</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-outline-variant)]/10">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-[var(--color-on-surface-variant)] text-sm">
                    No payout requests found for the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr
                    key={p.id}
                    className="hover:bg-[var(--color-surface-container-high)] transition-colors cursor-pointer group"
                    onClick={() => setSelected(p)}
                  >
                    <td className="px-6 py-4 font-mono text-xs text-[var(--brand-soft)]">
                      #{p.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--brand-strong)]/10 flex items-center justify-center text-[var(--brand-soft)] text-[10px] font-bold shrink-0">
                          {initials(p.driver.full_name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{p.driver.full_name || "Unknown"}</p>
                          <p className="text-xs text-[var(--color-on-surface-variant)]">{p.driver.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-white">{fmt(p.amount)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-[var(--color-on-surface-variant)]">
                      {fmtDate(p.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <PayoutActionButtons payout={p} onDone={() => {}} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-[var(--color-outline-variant)]/10">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-[var(--color-on-surface-variant)] text-sm">No payout requests found.</p>
          ) : (
            filtered.map(p => (
              <div
                key={p.id}
                className="px-4 py-4 hover:bg-[var(--color-surface-container-high)] transition-colors cursor-pointer"
                onClick={() => setSelected(p)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--brand-strong)]/10 flex items-center justify-center text-[var(--brand-soft)] text-xs font-bold shrink-0">
                      {initials(p.driver.full_name)}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{p.driver.full_name || "Unknown"}</p>
                      <p className="text-[var(--color-on-surface-variant)] text-xs">{p.driver.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-black text-sm">{fmt(p.amount)}</p>
                    <p className="text-[var(--color-on-surface-variant)] text-[10px]">{fmtDate(p.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <StatusBadge status={p.status} />
                  <span
                    className="text-[10px] text-[var(--color-on-surface-variant)] hover:text-white"
                    onClick={e => { e.stopPropagation(); setSelected(p) }}
                  >
                    View details →
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 md:px-8 py-4 bg-[var(--color-surface-container-high)]/30 flex items-center justify-between">
          <p className="text-xs text-[var(--color-on-surface-variant)]">
            {filtered.length} of {payouts.length} requests
          </p>
          <div className="flex gap-2">
            <button className="p-1.5 rounded-lg bg-[var(--color-surface-container-highest)] text-white hover:text-[var(--brand-soft)] transition-colors">
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <button className="p-1.5 rounded-lg bg-[var(--color-surface-container-highest)] text-white hover:text-[var(--brand-soft)] transition-colors">
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <PayoutDetailModal
          payout={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

