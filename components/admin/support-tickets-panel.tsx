/**
 * components/admin/support-tickets-panel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin view of all customer/driver support tickets: expandable rows with the
 * full message, and an Open ↔ Resolved status toggle.
 */
"use client"

import { useState, useTransition } from "react"
import { adminSetTicketStatus, type AdminSupportTicket } from "@/app/actions/support"

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

function RoleBadge({ role }: { role: string }) {
  const isDriver = role === "driver"
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
      isDriver ? "bg-[#c180ff]/10 text-[#c180ff]" : "bg-[#60a5fa]/10 text-[#60a5fa]"
    }`}>
      {role}
    </span>
  )
}

export function SupportTicketsPanel({ initialTickets }: { initialTickets: AdminSupportTicket[] }) {
  const [tickets, setTickets] = useState(initialTickets)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const openCount = tickets.filter((t) => t.status === "open").length

  function toggleStatus(ticket: AdminSupportTicket) {
    const newStatus = ticket.status === "open" ? "closed" : "open"
    setError(null)
    startTransition(async () => {
      const result = await adminSetTicketStatus(ticket.id, newStatus)
      if (result.error) { setError(result.error); return }
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, status: newStatus } : t)))
    })
  }

  return (
    <div className="pt-2 pb-12 px-2">
      <div className="mb-8 md:mb-10">
        <h2 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tighter text-white">Support Tickets</h2>
        <p className="text-[#adaaaa] mt-1">
          {openCount} open · {tickets.length} total
        </p>
      </div>

      {error && (
        <p className="mb-4 text-xs text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="bg-[#1a1919] border border-[#494847]/15 rounded-xl overflow-hidden">
        {tickets.length === 0 ? (
          <div className="py-16 text-center px-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[#262626] flex items-center justify-center">
              <span className="material-symbols-outlined text-[#a3a6ff]">support_agent</span>
            </div>
            <p className="text-sm font-bold text-white mb-1">No support tickets</p>
            <p className="text-xs text-[#adaaaa]">Tickets submitted by customers and drivers appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#494847]/5">
            {tickets.map((t) => {
              const expanded = expandedId === t.id
              const isOpen = t.status === "open"
              return (
                <div key={t.id}>
                  <button
                    onClick={() => setExpandedId(expanded ? null : t.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[#201f1f]/40 transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isOpen ? "bg-[#a3a6ff] animate-pulse" : "bg-[#6ee7b7]"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{t.subject}</p>
                      <p className="text-xs text-[#adaaaa] mt-0.5 flex items-center gap-2">
                        <span>{t.user_name}</span>
                        <RoleBadge role={t.user_role} />
                        <span>· {fmtDate(t.created_at)}</span>
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      isOpen
                        ? "bg-[#a3a6ff]/10 text-[#a3a6ff] border border-[#a3a6ff]/20"
                        : "bg-green-500/10 text-green-400 border border-green-500/20"
                    }`}>
                      {isOpen ? "Open" : "Resolved"}
                    </span>
                    <span className={`material-symbols-outlined text-[#adaaaa] text-lg transition-transform ${expanded ? "rotate-180" : ""}`}>
                      expand_more
                    </span>
                  </button>

                  {expanded && (
                    <div className="px-5 pb-5 pl-11">
                      <div className="bg-[#262626] rounded-xl px-4 py-3 mb-3">
                        <p className="text-sm text-[#e5e5e5] whitespace-pre-wrap leading-relaxed">{t.message}</p>
                      </div>
                      <button
                        onClick={() => toggleStatus(t)}
                        disabled={isPending}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 ${
                          isOpen
                            ? "bg-[#6ee7b7] text-[#052e16] hover:brightness-110"
                            : "bg-[#262626] text-[#adaaaa] hover:text-white border border-[#494847]/30"
                        }`}
                      >
                        {isPending ? "Updating…" : isOpen ? "Mark Resolved" : "Reopen Ticket"}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
