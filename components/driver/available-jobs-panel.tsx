"use client"

import { useState, useMemo } from "react"
import { AcceptJobButton } from "@/components/driver/accept-job-button"

type Job = {
  id: string
  tracking_number: string | null
  pickup_address: string | null
  delivery_address: string | null
  item_description: string | null
  item_value: number | null
  price: number | null
  status: string
  created_at: string
  driver_id?: string | null
}

type SortKey = "newest" | "oldest" | "payout_high" | "payout_low"

function fmt(v: number | null) {
  if (v == null) return null
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(v)
}

function fmtDate(v: string | null) {
  if (!v) return "—"
  return new Date(v).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export function AvailableJobsPanel({ jobs }: { jobs: Job[] }) {
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("newest")

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let list = jobs.filter(
      (j) =>
        !q ||
        j.pickup_address?.toLowerCase().includes(q) ||
        j.delivery_address?.toLowerCase().includes(q) ||
        j.item_description?.toLowerCase().includes(q) ||
        j.tracking_number?.toLowerCase().includes(q)
    )
    list = [...list].sort((a, b) => {
      if (sort === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sort === "payout_high") return (b.price ?? 0) - (a.price ?? 0)
      if (sort === "payout_low") return (a.price ?? 0) - (b.price ?? 0)
      return 0
    })
    return list
  }, [jobs, search, sort])

  return (
    <div className="pt-2 pb-12 px-2">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter text-white mb-2 font-headline">
          Available Jobs
        </h1>
        <p className="text-[#adaaaa] font-medium">
          {jobs.length === 0
            ? "No unassigned delivery requests right now."
            : `${filtered.length} of ${jobs.length} ${jobs.length === 1 ? "request" : "requests"} shown`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#adaaaa] text-sm">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by address or item..."
            className="w-full bg-[#1a1919] border border-[#494847]/20 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[#a3a6ff]/40 focus:ring-1 focus:ring-[#a3a6ff]/20 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#adaaaa] hover:text-white">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="bg-[#1a1919] border border-[#494847]/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#a3a6ff]/40 transition-all"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="payout_high">Highest payout</option>
          <option value="payout_low">Lowest payout</option>
        </select>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#494847]/30 bg-[#1a1919] px-6 py-16 text-center">
          <p className="text-lg font-semibold text-white">
            {search ? "No jobs match your search" : "No available jobs at the moment"}
          </p>
          <p className="mt-2 text-sm text-[#adaaaa]">
            {search ? "Try a different keyword or clear the search." : "Check back shortly — new requests will appear here."}
          </p>
          {search && (
            <button onClick={() => setSearch("")} className="mt-4 text-sm text-[#a3a6ff] hover:underline">
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filtered.map((job) => {
            const price = fmt(job.price)
            return (
              <div
                key={job.id}
                className="bg-[rgba(38,38,38,0.6)] backdrop-blur-xl border border-[#494847]/10 rounded-xl p-6 flex flex-col md:flex-row gap-6 hover:bg-[#1a1919] transition-all duration-300"
              >
                <div className="flex-1 space-y-5">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#262626] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#a3a6ff]">inventory_2</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-white truncate">{job.item_description || "Delivery request"}</h3>
                        <p className="text-xs text-[#adaaaa]">
                          Posted {fmtDate(job.created_at)}
                          {job.tracking_number ? ` · ${job.tracking_number}` : ""}
                        </p>
                      </div>
                    </div>
                    {price && (
                      <div className="text-right shrink-0">
                        <span className="text-2xl font-black text-[#a3a6ff] font-headline tracking-tighter">{price}</span>
                        <p className="text-[10px] text-[#adaaaa] uppercase font-bold">Payout</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center pt-1 shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-[#a3a6ff] bg-[#0e0e0e]" />
                      <div className="w-px h-8 border-l border-dashed border-[#494847] my-1" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#c180ff]" />
                    </div>
                    <div className="flex-1 space-y-3 min-w-0">
                      <div>
                        <p className="text-[10px] text-[#adaaaa] uppercase font-bold">Pickup</p>
                        <p className="text-sm font-semibold text-white break-words">{job.pickup_address || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#adaaaa] uppercase font-bold">Delivery</p>
                        <p className="text-sm font-semibold text-white break-words">{job.delivery_address || "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:w-px bg-[#494847]/10" />

                <div className="md:w-44 flex flex-col justify-between gap-4">
                  <div className="space-y-2 text-xs">
                    {job.item_value != null && (
                      <div className="flex justify-between">
                        <span className="text-[#adaaaa]">Item Value</span>
                        <span className="text-white font-bold">{fmt(job.item_value) ?? "—"}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[#adaaaa]">Status</span>
                      <span className="text-[#a3a6ff] font-bold uppercase">{job.status}</span>
                    </div>
                  </div>
                  <AcceptJobButton deliveryId={job.id} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
