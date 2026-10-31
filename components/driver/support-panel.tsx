"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { CustomerThread } from "@/components/shared/customer-thread"
import { createSupportTicket, getDriverTickets } from "@/app/actions/driver"
import type { SupportTicket } from "@/app/actions/driver"

function TicketStatusBadge({ status }: { status: "open" | "closed" }) {
  return status === "open" ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-[var(--brand-strong)]/10 text-[var(--brand-soft)] border border-[var(--brand-strong)]/20">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-strong)]" />Open
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
      if(!result.data){setError("Your request could not be loaded. Please retry.");return}
      onCreated(result.data)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-[var(--color-outline-variant)]/20 shadow-2xl overflow-hidden bg-[var(--brand-panel)]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-outline-variant)]/15">
          <h2 className="text-base font-bold text-white">New Support Ticket</h2>
          <button onClick={onClose} className="text-[var(--color-on-surface-variant)] hover:text-white">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-on-surface-variant)] uppercase tracking-wider">Subject *</label>
            <input
              name="subject"
              required
              placeholder="Brief description of your issue"
              className="w-full bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[var(--color-on-surface-variant)] focus:outline-none focus:border-[var(--brand-strong)]/40 focus:ring-1 focus:ring-[var(--brand-strong)]/20 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-on-surface-variant)] uppercase tracking-wider">Message *</label>
            <textarea
              name="message"
              required
              rows={5}
              placeholder="Describe your issue in detail..."
              className="w-full bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[var(--color-on-surface-variant)] focus:outline-none focus:border-[var(--brand-strong)]/40 focus:ring-1 focus:ring-[var(--brand-strong)]/20 transition-all resize-none"
            />
          </div>
          {error && (
            <p className="text-xs text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-[var(--color-surface-container-highest)] text-[var(--color-on-surface-variant)] font-semibold text-sm hover:text-white transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 rounded-xl bg-[var(--brand-strong)] text-[var(--brand-ink)] font-bold text-sm shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)] disabled:opacity-60 flex items-center justify-center gap-2"
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
  initialCount=initialTickets.length,
  subtitle = "Get help with your driver account.",
  showChatHint = true,
}: {
  initialTickets: SupportTicket[]
  initialCount?:number
  subtitle?: string
  showChatHint?: boolean
}) {
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets)
  const [page,setPage]=useState(1),[total,setTotal]=useState(initialCount),[selected,setSelected]=useState<string|null>(null),[listError,setListError]=useState(''),[loading,startLoad]=useTransition()
  const request=useRef(0)
  function load(next:number){const version=++request.current;startLoad(async()=>{try{const r=await getDriverTickets(next);if(version!==request.current)return;if(r.error)setListError(r.error);else{setTickets(r.data);setTotal(r.count);setPage(next);setListError('')}}catch{setListError('Could not load support requests. Please retry.')}})}
  useEffect(()=>{const timer=setInterval(()=>{if(!document.hidden)load(page)},30000);return()=>clearInterval(timer)},[page])
  const [showModal, setShowModal] = useState(false)

  function handleCreated(t: SupportTicket) {
    setSelected(t.id)
    load(1)
  }

  return (
    <div className="pt-2 pb-12 px-2">
      {showModal && <NewTicketModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 md:mb-10">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter text-white font-headline">Support</h1>
          <p className="text-[var(--color-on-surface-variant)] mt-1">{subtitle}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="self-start sm:self-auto flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-strong)] text-[var(--brand-ink)] font-bold text-sm rounded-xl shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)] active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          New Ticket
        </button>
      </div>

      {/* Live chat hint */}
      {showChatHint && (
      <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-[var(--brand-strong)]/10 border border-[var(--brand-strong)]/20">
        <div className="w-9 h-9 rounded-xl bg-[var(--brand-strong)]/20 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[var(--brand-soft)] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>chat_bubble</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Need instant help?</p>
          <p className="text-xs text-[var(--color-on-surface-variant)] mt-0.5">Use the <span className="text-[var(--brand-soft)] font-semibold">chat bubble</span> in the bottom-right corner to talk directly with our support team.</p>
        </div>
      </div>
      )}

      {/* My Tickets */}
      <div className="bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-outline-variant)]/10 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">My Tickets</h2>
          <span className="text-xs text-[var(--color-on-surface-variant)]">{total} total</span>
        </div>
        {tickets.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-white">No tickets yet</p>
            <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">Click "New Ticket" to contact support.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--brand-bg)] border-b border-[var(--color-outline-variant)]/10">
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-[var(--color-on-surface-variant)]">Ticket ID</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-[var(--color-on-surface-variant)]">Subject</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-[var(--color-on-surface-variant)]">Status</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-[var(--color-on-surface-variant)]">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-outline-variant)]/5">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-[var(--color-surface-container-high)]/40 transition-colors">
                    <td className="px-5 py-3.5 text-xs font-mono text-[var(--color-on-surface-variant)]">
                      #{t.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-white max-w-xs">
                      <button onClick={()=>setSelected(t.id)} className="block truncate text-left underline" title={t.subject}>{t.subject}</button>
                    </td>
                    <td className="px-5 py-3.5"><TicketStatusBadge status={t.status} /></td>
                    <td className="px-5 py-3.5 text-xs text-[var(--color-on-surface-variant)] whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {listError&&<p role="alert" className="my-3 text-red-300">{listError}<button onClick={()=>load(page)} className="ml-2 underline">Retry</button></p>}
      <div className="my-4 flex justify-between text-sm text-white"><button disabled={loading||page===1} onClick={()=>load(page-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(total/20))}</span><button disabled={loading||page*20>=total} onClick={()=>load(page+1)}>Next</button></div>
      {selected&&<CustomerThread key={selected} kind="support" id={selected}/>}
    </div>
  )
}

