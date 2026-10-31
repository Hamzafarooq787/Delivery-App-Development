"use client"

import { driverEarning } from "@/lib/driver-earnings"
import { useState, useMemo } from "react"
import Link from "next/link"

type Job = {
  id: string
  tracking_number: string | null
  pickup_address: string | null
  delivery_address: string | null
  driver_earning_quote?: number | null
  price: number | null
  created_at: string
  status: string
}

type Period = "all" | "week" | "month"

function fmt(v: number | null) {
  if (v == null) return "—"
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GBP" }).format(v)
}

function fmtDate(v: string | null) {
  if (!v) return "—"
  return new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function startOf(period: Period): Date {
  const now = new Date()
  if (period === "week") { now.setDate(now.getDate() - 7); return now }
  if (period === "month") { now.setDate(now.getDate() - 30); return now }
  return new Date(0)
}

export function CompletedJobsPanel({ jobs }: { jobs: Job[] }) {
  const [search, setSearch] = useState("")
  const [period, setPeriod] = useState<Period>("all")

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const cutoff = startOf(period)
    return jobs.filter(
      (j) =>
        new Date(j.created_at) >= cutoff &&
        (!q ||
          j.tracking_number?.toLowerCase().includes(q) ||
          j.pickup_address?.toLowerCase().includes(q) ||
          j.delivery_address?.toLowerCase().includes(q))
    )
  }, [jobs, search, period])

  const totalPayout = filtered.reduce((s, j) => s + driverEarning(j), 0)

  return (
    <div className="pt-2 pb-12 px-2">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter text-white mb-2 font-headline">
          Completed Jobs
        </h1>
        <p className="text-[var(--color-on-surface-variant)] font-medium">
          {filtered.length} {filtered.length === 1 ? "delivery" : "deliveries"} on this page · Page payout {fmt(totalPayout)}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] text-sm">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tracking # or address..."
            className="w-full bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/20 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[var(--color-on-surface-variant)] focus:outline-none focus:border-[var(--brand-strong)]/40 focus:ring-1 focus:ring-[var(--brand-strong)]/20 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] hover:text-white">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>

        {/* Period tabs */}
        <div className="flex bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/20 rounded-xl p-1">
          {([["all", "All Time"], ["week", "This Week"], ["month", "This Month"]] as [Period, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setPeriod(val)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                period === val
                  ? "bg-[var(--brand-strong)] text-[var(--brand-ink)]"
                  : "text-[var(--color-on-surface-variant)] hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-outline-variant)]/30 bg-[var(--brand-panel)] px-6 py-16 text-center">
          <p className="text-lg font-semibold text-white">No completed jobs yet</p>
          <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">Completed deliveries will appear here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-outline-variant)]/30 bg-[var(--brand-panel)] px-6 py-12 text-center">
          <p className="text-base font-semibold text-white">No results</p>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">Try a different search or time range.</p>
          <button onClick={() => { setSearch(""); setPeriod("all") }} className="mt-3 text-sm text-[var(--brand-soft)] hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-outline-variant)]/15 bg-[var(--brand-panel)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--brand-bg)] border-b border-[var(--color-outline-variant)]/10">
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-[var(--color-on-surface-variant)]">Tracking #</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-[var(--color-on-surface-variant)]">Date</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-[var(--color-on-surface-variant)]">Pickup</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-[var(--color-on-surface-variant)]">Delivery</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-[var(--color-on-surface-variant)]">Payout</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-outline-variant)]/5">
                {filtered.map((job) => (
                  <tr key={job.id} className="hover:bg-[var(--color-surface-container-high)]/40 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-mono font-medium text-white">
                      {job.tracking_number || job.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[var(--color-on-surface-variant)] whitespace-nowrap">{fmtDate(job.created_at)}</td>
                    <td className="px-5 py-3.5 text-sm text-[var(--color-on-surface-variant)] max-w-[160px]">
                      <span className="block truncate" title={job.pickup_address ?? ""}>{job.pickup_address || "—"}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[var(--color-on-surface-variant)] max-w-[160px]">
                      <span className="block truncate" title={job.delivery_address ?? ""}>{job.delivery_address || "—"}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-[var(--brand-soft)]">{fmt(driverEarning(job))}</td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/dashboard/driver/jobs/${job.id}`}
                        className="text-xs font-semibold text-[var(--color-on-surface-variant)] hover:text-[var(--brand-soft)] transition-colors"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-[var(--brand-bg)]/40 border-t border-[var(--color-outline-variant)]/10 flex justify-between items-center">
            <p className="text-xs text-[var(--color-on-surface-variant)]">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</p>
            <p className="text-xs font-semibold text-[var(--brand-soft)]">This page: {fmt(totalPayout)}</p>
          </div>
        </div>
      )}
    </div>
  )
}

