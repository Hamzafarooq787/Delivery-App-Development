"use client"

import { useState, useTransition } from "react"
import { adminUpdateDisputeStatus } from "@/app/actions/delivery"

type Dispute = {
  id: string
  status: string
  category: string | null
  description: string | null
  created_at: string
  user_id: string | null
  delivery_request_id: string | null
}

type Tab = "All Cases" | "Open" | "Escalated" | "Resolved" | "Closed"

const DISPUTE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  open: { bg: "bg-[var(--color-secondary)]/10", text: "text-[var(--color-secondary)]", dot: "bg-[var(--color-secondary)]" },
  escalated: { bg: "bg-[#ff6e84]/10", text: "text-[#ff6e84]", dot: "bg-[#ff6e84]" },
  resolved: { bg: "bg-[var(--brand-strong)]/10", text: "text-[var(--brand-soft)]", dot: "bg-[var(--brand-strong)]" },
  closed: { bg: "bg-[var(--color-outline-variant)]/10", text: "text-[var(--color-on-surface-variant)]", dot: "bg-[var(--color-outline-variant)]" },
}

const CATEGORY_ICONS: Record<string, string> = {
  late_delivery: "schedule",
  damaged_goods: "package_2",
  wrong_item: "swap_horiz",
  missing_item: "inventory_2",
  overcharge: "receipt_long",
  other: "help_outline",
}

const TAB_FILTER: Record<Tab, string | null> = {
  "All Cases": null,
  Open: "open",
  Escalated: "escalated",
  Resolved: "resolved",
  Closed: "closed",
}

export function DisputesPanel({ disputes: initial, total }: { disputes: Dispute[]; total: number }) {
  const [activeTab, setActiveTab] = useState<Tab>("All Cases")
  const [disputes, setDisputes] = useState(initial)
  const [isPending, startTransition] = useTransition()

  const filterStatus = TAB_FILTER[activeTab]
  const filtered = filterStatus ? disputes.filter((d) => d.status === filterStatus) : disputes

  const openCount = disputes.filter((d) => d.status === "open").length
  const escalatedCount = disputes.filter((d) => d.status === "escalated").length
  const resolvedCount = disputes.filter((d) => d.status === "resolved").length

  function handleAction(id: string, newStatus: string) {
    startTransition(async () => {
      const result = await adminUpdateDisputeStatus(id, newStatus)
      if (!result.error) {
        setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status: newStatus } : d)))
      }
    })
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[var(--brand-bg)]">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-headline font-black tracking-tight text-white">Dispute Resolution</h1>
          <p className="text-[var(--color-on-surface-variant)] mt-2 text-sm">Active cases between clients and field agents — escalate or close each record.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/20 px-4 py-2 rounded-full text-sm">
            <span className="material-symbols-outlined text-xs text-[var(--color-on-surface-variant)]">search</span>
            <input type="text" placeholder="Search cases..." className="bg-transparent text-white text-xs placeholder-[var(--color-outline-variant)] outline-none w-32" />
          </div>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 md:mb-8">
        {[
          { label: "Open Cases", count: openCount, desc: "Requires intervention", colors: DISPUTE_COLORS.open, icon: "error_outline" },
          { label: "Escalated", count: escalatedCount, desc: "Flagged — urgent", colors: DISPUTE_COLORS.escalated, icon: "priority_high" },
          { label: "Resolved", count: resolvedCount, desc: "Closed successfully", colors: DISPUTE_COLORS.resolved, icon: "check_circle" },
        ].map(({ label, count, desc, colors, icon }) => (
          <div key={label} className="bg-[var(--brand-panel)] p-6 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[var(--color-on-surface-variant)] text-[10px] uppercase tracking-widest font-bold mb-1">{label}</p>
              <p className="text-3xl font-extrabold font-headline text-white">{count}</p>
              <p className="text-[var(--color-on-surface-variant)] text-xs mt-1">{desc}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center`}>
              <span className={`material-symbols-outlined text-xl ${colors.text}`}>{icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {(Object.keys(TAB_FILTER) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === tab
                ? "bg-[var(--brand-strong)] text-[var(--brand-ink)]"
                : "bg-[var(--brand-panel)] text-[var(--color-on-surface-variant)] hover:text-white border border-[var(--color-outline-variant)]/10"
            }`}
          >
            {tab}
          </button>
        ))}
        <div className="ml-auto text-[var(--color-on-surface-variant)] text-xs">{total} total cases</div>
      </div>

      {/* Dispute Cards */}
      {filtered.length === 0 ? (
        <div className="bg-[var(--brand-panel)] rounded-xl p-16 text-center">
          <span className="material-symbols-outlined text-4xl text-[var(--color-on-surface-variant)] mb-4 block">gavel</span>
          <p className="text-[var(--color-on-surface-variant)] text-sm">No disputes found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((dispute) => {
            const statusCfg = DISPUTE_COLORS[dispute.status] ?? DISPUTE_COLORS.open
            const categoryIcon = CATEGORY_ICONS[dispute.category ?? "other"] ?? CATEGORY_ICONS.other
            const categoryLabel = (dispute.category ?? "other").replace(/_/g, " ")
            const shortId = `#DSP-${dispute.id.slice(0, 5).toUpperCase()}`
            const dateStr = new Date(dispute.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            const canEscalate = dispute.status === "open"
            const canResolve = dispute.status === "open" || dispute.status === "escalated"

            return (
              <div key={dispute.id} className="group bg-[var(--brand-panel)] hover:bg-[var(--color-surface-container-high)] rounded-xl p-4 md:p-6 flex items-center gap-4 md:gap-8 transition-all">
                <div className={`w-12 h-12 rounded-xl ${statusCfg.bg} flex items-center justify-center shrink-0`}>
                  <span className={`material-symbols-outlined text-xl ${statusCfg.text}`}>{categoryIcon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-mono text-[var(--brand-soft)]">{shortId}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusCfg.bg} ${statusCfg.text} flex items-center gap-1`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                      {dispute.status}
                    </span>
                  </div>
                  <p className="text-white font-semibold text-sm capitalize truncate">{categoryLabel}</p>
                  <p className="text-[var(--color-on-surface-variant)] text-xs mt-1 line-clamp-1">{dispute.description ?? "No description provided."}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-[var(--color-on-surface-variant)] uppercase tracking-widest">Filed</p>
                  <p className="text-sm font-semibold text-white">{dateStr}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  {canResolve && (
                    <button
                      disabled={isPending}
                      onClick={() => handleAction(dispute.id, "resolved")}
                      className={`px-3 py-1.5 rounded-lg ${statusCfg.bg} ${statusCfg.text} text-[10px] font-bold uppercase hover:scale-105 transition-transform disabled:opacity-50`}
                    >
                      Resolve
                    </button>
                  )}
                  {canEscalate && (
                    <button
                      disabled={isPending}
                      onClick={() => handleAction(dispute.id, "escalated")}
                      className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-container-highest)] text-[var(--color-on-surface-variant)] hover:text-white text-[10px] font-bold uppercase hover:scale-105 transition-transform disabled:opacity-50"
                    >
                      Escalate
                    </button>
                  )}
                  {!canResolve && !canEscalate && (
                    <span className="px-3 py-1.5 text-[10px] font-bold text-[var(--color-outline-variant)] uppercase">Closed</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

