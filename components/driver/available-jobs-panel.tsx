"use client"

import { driverEarning } from "@/lib/driver-earnings"
import { useState, useMemo, useEffect } from "react"
import { AcceptJobButton } from "@/components/driver/accept-job-button"
import { PACKAGE_SIZE_INFO, isPackageSize } from "@/lib/vehicles"

type Job = {
  driver_earning_quote?: number | null
  distance_miles?: number | null
  duration_min?: number | null
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
  pickup_lat?: number | null
  pickup_lng?: number | null
  package_size?: string | null
  service_type?: string | null
  shop_name?: string | null
  estimated_items_total?: number | null
}

type SortKey = "newest" | "oldest" | "payout_high" | "payout_low"

function fmt(v: number | null) {
  if (v == null) return null
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GBP" }).format(v)
}

function fmtDate(v: string | null) {
  if (!v) return "—"
  return new Date(v).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function AvailableJobsPanel({ jobs }: { jobs: Job[] }) {
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("newest")
  const [driverGps, setDriverGps] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!("geolocation" in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setDriverGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    )
  }, [])

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
      if (sort === "payout_high") return driverEarning(b) - driverEarning(a)
      if (sort === "payout_low") return driverEarning(a) - driverEarning(b)
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
        <p className="text-[var(--color-on-surface-variant)] font-medium">
          {jobs.length === 0
            ? "No unassigned delivery requests right now."
            : `${filtered.length} of ${jobs.length} ${jobs.length === 1 ? "request" : "requests"} shown`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] text-sm">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by address or item..."
            className="w-full bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/20 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[var(--color-on-surface-variant)] focus:outline-none focus:border-[var(--brand-strong)]/40 focus:ring-1 focus:ring-[var(--brand-strong)]/20 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] hover:text-white">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--brand-strong)]/40 transition-all"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="payout_high">Highest payout</option>
          <option value="payout_low">Lowest payout</option>
        </select>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-outline-variant)]/30 bg-[var(--brand-panel)] px-6 py-16 text-center">
          <p className="text-lg font-semibold text-white">
            {search ? "No jobs match your search" : "No available jobs at the moment"}
          </p>
          <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
            {search ? "Try a different keyword or clear the search." : "Check back shortly — new requests will appear here."}
          </p>
          {search && (
            <button onClick={() => setSearch("")} className="mt-4 text-sm text-[var(--brand-soft)] hover:underline">
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filtered.map((job) => {
            const price = fmt(driverEarning(job))
            const distanceMiles =
              driverGps && job.pickup_lat != null && job.pickup_lng != null
                ? haversineMiles(driverGps.lat, driverGps.lng, Number(job.pickup_lat), Number(job.pickup_lng))
                : null
            return (
              <div
                key={job.id}
                className="bg-[var(--brand-panel)] backdrop-blur-xl border border-[var(--color-outline-variant)]/10 rounded-xl p-6 flex flex-col md:flex-row gap-6 hover:bg-[var(--brand-panel)] transition-all duration-300"
              >
                <div className="flex-1 space-y-5">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-container-highest)] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[var(--brand-soft)]">
                          {job.service_type === "buy_for_me" ? "shopping_bag" : "inventory_2"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-white truncate">
                            {job.service_type === "buy_for_me"
                              ? (job.shop_name || "Shopping request")
                              : (job.item_description || "Delivery request")}
                          </h3>
                          {job.service_type === "buy_for_me" ? (
                            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border border-[var(--color-secondary)]/20">
                              BUY FOR ME
                            </span>
                          ) : job.package_size && isPackageSize(job.package_size) ? (
                            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[var(--brand-strong)]/10 text-[var(--brand-soft)] border border-[var(--brand-strong)]/20">
                              {PACKAGE_SIZE_INFO[job.package_size].label}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-[var(--color-on-surface-variant)]">
                          Posted {fmtDate(job.created_at)}
                          {job.tracking_number ? ` · ${job.tracking_number}` : ""}
                        </p>
                      </div>
                    </div>
                    {price && (
                      <div className="text-right shrink-0">
                        <span className="text-2xl font-black text-[var(--brand-soft)] font-headline tracking-tighter">{price}</span>
                        <p className="text-[10px] text-[var(--color-on-surface-variant)] uppercase font-bold">Your earnings</p>
                        <p className="text-xs">{job.distance_miles != null ? `${Number(job.distance_miles).toFixed(1)} driving miles` : "Distance available in job details"}{job.duration_min != null ? ` · approx. ${Math.round(job.duration_min)} min` : ""}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center pt-1 shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-[var(--brand-strong)] bg-[var(--brand-bg)]" />
                      <div className="w-px h-8 border-l border-dashed border-[var(--color-outline-variant)] my-1" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-secondary)]" />
                    </div>
                    <div className="flex-1 space-y-3 min-w-0">
                      <div>
                        <p className="text-[10px] text-[var(--color-on-surface-variant)] uppercase font-bold">Pickup</p>
                        <p className="text-sm font-semibold text-white break-words">{job.pickup_address || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--color-on-surface-variant)] uppercase font-bold">Delivery</p>
                        <p className="text-sm font-semibold text-white break-words">{job.delivery_address || "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:w-px bg-[var(--color-outline-variant)]/10" />

                <div className="md:w-44 flex flex-col justify-between gap-4">
                  <div className="space-y-2 text-xs">
                    {distanceMiles != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--color-on-surface-variant)]">Distance to pickup</span>
                        <span className="text-green-400 font-black">{distanceMiles.toFixed(1)} mi</span>
                      </div>
                    )}
                    {job.service_type === "buy_for_me" && job.estimated_items_total != null && (
                      <div className="flex justify-between">
                        <span className="text-[var(--color-on-surface-variant)]">Est. Items</span>
                        <span className="text-white font-bold">{fmt(job.estimated_items_total)}</span>
                      </div>
                    )}
                    {job.service_type !== "buy_for_me" && job.item_value != null && (
                      <div className="flex justify-between">
                        <span className="text-[var(--color-on-surface-variant)]">Item Value</span>
                        <span className="text-white font-bold">{fmt(job.item_value) ?? "—"}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[var(--color-on-surface-variant)]">Status</span>
                      <span className="text-[var(--brand-soft)] font-bold uppercase">{job.status}</span>
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

