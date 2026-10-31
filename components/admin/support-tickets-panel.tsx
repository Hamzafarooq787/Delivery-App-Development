/**
 * components/admin/support-tickets-panel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin view of all customer/driver support tickets: expandable rows with the
 * full message, and an Open ↔ Resolved status toggle.
 */
"use client"

import { useState, useTransition, useEffect } from "react"
import { adminGetSupportTickets, adminSetTicketStatus, type AdminSupportTicket } from "@/app/actions/support"

import { CustomerThread } from "@/components/shared/customer-thread"

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

function RoleBadge({ role }: { role: string }) {
  const isDriver = role === "driver"
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
      isDriver ? "bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]" : "bg-[#60a5fa]/10 text-[#60a5fa]"
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

  useEffect(() => { let alive = true, busy = false; const refresh = async () => { if (busy || document.visibilityState !== 'visible') return; busy = true; try { const r = await adminGetSupportTickets(); if (alive) { if (r.error) setError(r.error); else setTickets(r.data) } } catch { if (alive) setError('Could not refresh tickets.') } finally { busy = false } }; const timer = setInterval(refresh,15000); window.addEventListener('focus',refresh); return () => { alive=false;clearInterval(timer);window.removeEventListener('focus',refresh) } }, [])
  const openCount = tickets.filter((t) => t.status === "open").length

  function toggleStatus(ticket: AdminSupportTicket) {
    const newStatus = ticket.status === "open" ? "closed" : "open"
    setError(null)
    startTransition(async () => {
      try {
      const result = await adminSetTicketStatus(ticket.id, newStatus)
      if (result.error) { setError(result.error); return }
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, status: newStatus } : t)))
      } catch { setError("Could not update ticket status. Please try again.") }
    })
  }

  return (
    <div className="pt-2 pb-12 px-2">
      <div className="mb-8 md:mb-10">
        <h2 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tighter text-white">Support Tickets</h2>
        <p className="text-[var(--color-on-surface-variant)] mt-1">
          {openCount} open · {tickets.length} total
        </p>
      </div>

      {error && (
        <p className="mb-4 text-xs text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 rounded-xl overflow-hidden">
        {tickets.length === 0 ? (
          <div className="py-16 text-center px-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[var(--color-surface-container-highest)] flex items-center justify-center">
              <span className="material-symbols-outlined text-[var(--brand-soft)]">support_agent</span>
            </div>
            <p className="text-sm font-bold text-white mb-1">No support tickets</p>
            <p className="text-xs text-[var(--color-on-surface-variant)]">Tickets submitted by customers and drivers appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-outline-variant)]/5">
            {tickets.map((t) => {
              const expanded = expandedId === t.id
              const isOpen = t.status === "open"
              return (
                <div key={t.id}>
                  <button
                    onClick={() => setExpandedId(expanded ? null : t.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[var(--color-surface-container-high)]/40 transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isOpen ? "bg-[var(--brand-strong)] animate-pulse" : "bg-[#6ee7b7]"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{t.subject}</p>
                      <p className="text-xs text-[var(--color-on-surface-variant)] mt-0.5 flex items-center gap-2">
                        <span>{t.user_name}</span>
                        <RoleBadge role={t.user_role} />
                        <span>· {fmtDate(t.created_at)}</span>
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      isOpen
                        ? "bg-[var(--brand-strong)]/10 text-[var(--brand-soft)] border border-[var(--brand-strong)]/20"
                        : "bg-green-500/10 text-green-400 border border-green-500/20"
                    }`}>
                      {isOpen ? "Open" : "Resolved"}
                    </span>
                    <span className={`material-symbols-outlined text-[var(--color-on-surface-variant)] text-lg transition-transform ${expanded ? "rotate-180" : ""}`}>
                      expand_more
                    </span>
                  </button>

                  {expanded && (
                    <div className="px-5 pb-5 pl-11">
                      <CustomerThread kind="support" id={t.id} />
                      <button
                        onClick={() => toggleStatus(t)}
                        disabled={isPending}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 ${
                          isOpen
                            ? "bg-[#6ee7b7] text-[#052e16] hover:brightness-110"
                            : "bg-[var(--color-surface-container-highest)] text-[var(--color-on-surface-variant)] hover:text-white border border-[var(--color-outline-variant)]/30"
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

