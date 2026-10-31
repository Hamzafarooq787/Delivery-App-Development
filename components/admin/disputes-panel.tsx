"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { adminUpdateDisputeStatus } from "@/app/actions/delivery"

type Dispute = {
  id: string
  status: string
  issue: string | null
  created_at: string
  raised_by: string | null
  delivery_id: string | null
}

const tabs = ["all", "open", "resolved", "rejected"] as const
export function DisputesPanel({ disputes: initial, total }: { disputes: Dispute[]; total: number }) {
  const [status, setStatus] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [disputes, setDisputes] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const query = search.trim().toLowerCase()
  const filtered = disputes.filter(d => (status === "all" || d.status === status) &&
    [d.id, d.issue, d.delivery_id].some(value => value?.toLowerCase().includes(query)))

  function update(id: string, next: "resolved" | "rejected") {
    setError(null)
    startTransition(async () => {
      try {
        const result = await adminUpdateDisputeStatus(id, next)
        if (result.error) { setError(result.error); return }
        setDisputes(previous => previous.map(d => d.id === id ? { ...d, status: next } : d))
      } catch { setError("Could not update this dispute. Please retry.") }
    })
  }

  return <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[var(--brand-bg)]">
    <h1 className="text-3xl md:text-4xl font-headline font-black text-white">Dispute Resolution</h1>
    <p className="text-[var(--color-on-surface-variant)] mt-2 text-sm">Review open cases and record the outcome.</p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
      {tabs.slice(1).map(value => <div key={value} className="bg-[var(--brand-panel)] rounded-xl p-6">
        <p className="capitalize text-[var(--color-on-surface-variant)]">{value} cases</p>
        <p className="text-3xl font-bold text-white">{disputes.filter(d => d.status === value).length}</p>
      </div>)}
    </div>
    <div className="flex flex-wrap gap-2 items-center mb-5">
      {tabs.map(value => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}
        className={`rounded-full px-4 py-2 capitalize text-sm ${status === value ? "bg-[var(--brand-strong)] text-[var(--brand-ink)]" : "bg-[var(--brand-panel)] text-white"}`}>{value === "all" ? "All cases" : value}</button>)}
      <input aria-label="Search loaded disputes" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search cases…"
        className="sm:ml-auto rounded-xl border border-white/20 bg-[var(--brand-panel)] px-4 py-2 text-white max-w-full" />
    </div>
    <p className="text-sm text-[var(--color-on-surface-variant)] mb-4">Showing {initial.length} of {total} cases{total > initial.length ? " (latest 50)" : ""}.</p>
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-400/30 p-4 text-red-300">{error}</p>}
    <div className="space-y-3">
      {filtered.length === 0 && <p className="bg-[var(--brand-panel)] rounded-xl p-10 text-center text-white">No disputes found.</p>}
      {filtered.map(dispute => <article key={dispute.id} className="bg-[var(--brand-panel)] rounded-xl p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className="flex-1 min-w-0">
          <div className="flex gap-3 items-center text-sm"><span className="text-[var(--brand-soft)]">#DSP-{dispute.id.slice(0, 5).toUpperCase()}</span><span className="capitalize text-white">{dispute.status}</span></div>
          <p className="text-white mt-2 whitespace-pre-wrap break-words">{dispute.issue || "No description provided."}</p>
          <p className="text-xs text-[var(--color-on-surface-variant)] mt-2">{new Date(dispute.created_at.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dispute.created_at) ? dispute.created_at : dispute.created_at + "Z").toLocaleDateString("en-GB", { timeZone: "Europe/London" })}</p>
          {dispute.delivery_id && <Link className="inline-block underline text-sm mt-2 text-[var(--brand-soft)]" href={`/dashboard/admin/orders/${dispute.delivery_id}`}>View order</Link>}
        </div>
        {dispute.status === "open" && <div className="flex gap-2">
          <button disabled={pending} onClick={() => update(dispute.id, "resolved")} className="px-4 py-2 rounded-lg bg-[var(--brand-strong)] text-[var(--brand-ink)] disabled:opacity-50">Resolve</button>
          <button disabled={pending} onClick={() => update(dispute.id, "rejected")} className="px-4 py-2 rounded-lg border border-white/20 text-white disabled:opacity-50">Reject</button>
        </div>}
      </article>)}
    </div>
  </div>
}
