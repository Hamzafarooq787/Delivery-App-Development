"use client"

import { useState, useTransition } from "react"
import { createSupportTicket } from "@/app/actions/driver"
import type { SupportTicket } from "@/app/actions/driver"

function TicketStatusBadge({ status }: { status: "open" | "closed" }) {
  return status === "open" ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />Open
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-green-500/10 text-green-400 border border-green-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />Resolved
    </span>
  )
}

function NewTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: SupportTicket) => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await createSupportTicket(formData)
      if (result.error) { setError(result.error); return }
      onCreated({
        id: Date.now().toString(),
        subject: formData.get("subject") as string,
        message: formData.get("message") as string,
        status: "open",
        created_at: new Date().toISOString(),
      })
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-[#494847]/20 shadow-2xl overflow-hidden bg-[#1a1919]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#494847]/15">
          <h2 className="text-base font-bold text-white">New Support Ticket</h2>
          <button onClick={onClose} className="text-[#adaaaa] hover:text-white">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">Subject *</label>
            <input
              name="subject"
              required
              placeholder="Brief description of your issue"
              className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[var(--color-primary)]/40 focus:ring-1 focus:ring-[var(--color-primary)]/20 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">Message *</label>
            <textarea
              name="message"
              required
              rows={5}
              placeholder="Describe your issue in detail..."
              className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[var(--color-primary)]/40 focus:ring-1 focus:ring-[var(--color-primary)]/20 transition-all resize-none"
            />
          </div>
          {error && (
            <p className="text-xs text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-[#262626] text-[#adaaaa] font-semibold text-sm hover:text-white transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 rounded-xl bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold text-sm shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Submitting...</>
              ) : "Submit Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function SupportPanel({
  initialTickets,
  subtitle = "Get help with your driver account.",
  showChatHint = true,
}: {
  initialTickets: SupportTicket[]
  subtitle?: string
  showChatHint?: boolean
}) {
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets)
  const [showModal, setShowModal] = useState(false)

  function handleCreated(t: SupportTicket) {
    setTickets((prev) => [t, ...prev])
  }

  return (
    <div className="pt-2 pb-12 px-2">
      {showModal && <NewTicketModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 md:mb-10">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter text-white font-headline">Support</h1>
          <p className="text-[#adaaaa] mt-1">{subtitle}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="self-start sm:self-auto flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold text-sm rounded-xl shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)] active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          New Ticket
        </button>
      </div>

      {/* Live chat hint */}
      {showChatHint && (
      <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20">
        <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/20 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[var(--color-primary)] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>chat_bubble</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Need instant help?</p>
          <p className="text-xs text-[#adaaaa] mt-0.5">Use the <span className="text-[var(--color-primary)] font-semibold">chat bubble</span> in the bottom-right corner to talk directly with our support team.</p>
        </div>
      </div>
      )}

      {/* My Tickets */}
      <div className="bg-[#1a1919] border border-[#494847]/15 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#494847]/10 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">My Tickets</h2>
          <span className="text-xs text-[#adaaaa]">{tickets.length} total</span>
        </div>
        {tickets.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-white">No tickets yet</p>
            <p className="mt-1 text-xs text-[#adaaaa]">Click "New Ticket" to contact support.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#131313] border-b border-[#494847]/10">
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-[#adaaaa]">Ticket ID</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-[#adaaaa]">Subject</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-[#adaaaa]">Status</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-[#adaaaa]">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#494847]/5">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-[#201f1f]/40 transition-colors">
                    <td className="px-5 py-3.5 text-xs font-mono text-[#adaaaa]">
                      #{t.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-white max-w-xs">
                      <span className="block truncate" title={t.subject}>{t.subject}</span>
                    </td>
                    <td className="px-5 py-3.5"><TicketStatusBadge status={t.status} /></td>
                    <td className="px-5 py-3.5 text-xs text-[#adaaaa] whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

