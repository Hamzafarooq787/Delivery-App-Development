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
  open: { bg: "bg-[#c180ff]/10", text: "text-[#c180ff]", dot: "bg-[#c180ff]" },
  escalated: { bg: "bg-[#ff6e84]/10", text: "text-[#ff6e84]", dot: "bg-[#ff6e84]" },
  resolved: { bg: "bg-[#a3a6ff]/10", text: "text-[#a3a6ff]", dot: "bg-[#a3a6ff]" },
  closed: { bg: "bg-[#494847]/10", text: "text-[#adaaaa]", dot: "bg-[#494847]" },
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
    <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[#131313]">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-headline font-black tracking-tight text-white">Dispute Resolution</h1>
          <p className="text-[#adaaaa] mt-2 text-sm">Active cases between clients and field agents — escalate or close each record.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#1a1919] border border-[#494847]/20 px-4 py-2 rounded-full text-sm">
            <span className="material-symbols-outlined text-xs text-[#adaaaa]">search</span>
            <input type="text" placeholder="Search cases..." className="bg-transparent text-white text-xs placeholder-[#494847] outline-none w-32" />
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
          <div key={label} className="bg-[#1a1919] p-6 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold mb-1">{label}</p>
              <p className="text-3xl font-extrabold font-headline text-white">{count}</p>
              <p className="text-[#adaaaa] text-xs mt-1">{desc}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center`}>
              <span className={`material-symbols-outlined text-xl ${colors.text}`}>{icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-5">
        {(Object.keys(TAB_FILTER) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === tab
                ? "bg-[#a3a6ff] text-[#0f00a4]"
                : "bg-[#1a1919] text-[#adaaaa] hover:text-white border border-[#494847]/10"
            }`}
          >
            {tab}
          </button>
        ))}
        <div className="ml-auto text-[#adaaaa] text-xs">{total} total cases</div>
      </div>

      {/* Dispute Cards */}
      {filtered.length === 0 ? (
        <div className="bg-[#1a1919] rounded-xl p-16 text-center">
          <span className="material-symbols-outlined text-4xl text-[#adaaaa] mb-4 block">gavel</span>
          <p className="text-[#adaaaa] text-sm">No disputes found.</p>
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
              <div key={dispute.id} className="group bg-[#1a1919] hover:bg-[#201f1f] rounded-xl p-4 md:p-6 flex items-center gap-4 md:gap-8 transition-all">
                <div className={`w-12 h-12 rounded-xl ${statusCfg.bg} flex items-center justify-center shrink-0`}>
                  <span className={`material-symbols-outlined text-xl ${statusCfg.text}`}>{categoryIcon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-mono text-[#a3a6ff]">{shortId}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusCfg.bg} ${statusCfg.text} flex items-center gap-1`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                      {dispute.status}
                    </span>
                  </div>
                  <p className="text-white font-semibold text-sm capitalize truncate">{categoryLabel}</p>
                  <p className="text-[#adaaaa] text-xs mt-1 line-clamp-1">{dispute.description ?? "No description provided."}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-[#adaaaa] uppercase tracking-widest">Filed</p>
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
                      className="px-3 py-1.5 rounded-lg bg-[#262626] text-[#adaaaa] hover:text-white text-[10px] font-bold uppercase hover:scale-105 transition-transform disabled:opacity-50"
                    >
                      Escalate
                    </button>
                  )}
                  {!canResolve && !canEscalate && (
                    <span className="px-3 py-1.5 text-[10px] font-bold text-[#494847] uppercase">Closed</span>
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
