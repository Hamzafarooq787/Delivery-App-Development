"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AssignDriverDropdown, type DriverOption } from "@/components/admin/assign-driver-dropdown"

type DeliveryRequest = {
  id: string
  tracking_number: string | null
  customer_id: string | null
  driver_id: string | null
  pickup_address: string | null
  pickup_lat: number | null
  pickup_lng: number | null
  delivery_address: string | null
  delivery_lat: number | null
  delivery_lng: number | null
  item_description: string | null
  item_value: number | null
  price: number | null
  status: string
  is_safe_confirmed: boolean | null
  created_at: string
}

const FINAL_STATUSES = new Set(["delivered", "cancelled"])
const PAGE_SIZE = 10

const ALL_STATUSES = ["requested", "accepted", "collected", "in_transit", "delivered", "cancelled"]

export function DeliveriesLedger({
  initialDeliveries,
  drivers = [],
}: {
  initialDeliveries: DeliveryRequest[]
  drivers?: DriverOption[]
}) {
  const [deliveries, setDeliveries] = useState<DeliveryRequest[]>(initialDeliveries)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("admin-delivery-requests")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "delivery_requests" }, (payload) => {
        const next = payload.new as DeliveryRequest
        setDeliveries((prev) => prev.some((d) => d.id === next.id) ? prev : [next, ...prev])
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "delivery_requests" }, (payload) => {
        const next = payload.new as DeliveryRequest
        setDeliveries((prev) => prev.map((d) => (d.id === next.id ? { ...d, ...next } : d)))
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "delivery_requests" }, (payload) => {
        const old = payload.old as { id: string }
        setDeliveries((prev) => prev.filter((d) => d.id !== old.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── Filter + search ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return deliveries.filter((d) => {
      const matchStatus = statusFilter === "all" || d.status === statusFilter
      if (!matchStatus) return false
      if (!q) return true
      const trk = (d.tracking_number ?? `KV-${d.id.slice(0, 8).toUpperCase()}`).toLowerCase()
      return (
        trk.includes(q) ||
        (d.pickup_address ?? "").toLowerCase().includes(q) ||
        (d.delivery_address ?? "").toLowerCase().includes(q) ||
        (d.item_description ?? "").toLowerCase().includes(q)
      )
    })
  }, [deliveries, query, statusFilter])

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // reset to page 1 when filter changes
  useEffect(() => { setPage(1) }, [query, statusFilter])

  // ── CSV Export ────────────────────────────────────────────────────────────
  function handleExport() {
    const headers = ["Tracking #", "Status", "Pickup Address", "Delivery Address", "Item", "Price (£)", "Date"]
    const rows = filtered.map((d) => [
      d.tracking_number ?? `KV-${d.id.slice(0, 8).toUpperCase()}`,
      d.status,
      d.pickup_address ?? "",
      d.delivery_address ?? "",
      d.item_description ?? "",
      d.price?.toFixed(2) ?? "",
      new Date(d.created_at).toLocaleDateString("en-GB"),
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = `deliveries-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-[#1a1919]/60 backdrop-blur-xl border border-[#494847]/15 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 bg-[#1a1919]/50 border-b border-[#494847]/10 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 bg-[#0e0e0e] border border-[#494847]/20 rounded-lg px-3 py-2 flex-1 min-w-[180px]">
          <span className="material-symbols-outlined text-[#adaaaa] text-[16px]">search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracking, address, item…"
            className="bg-transparent text-white text-xs placeholder-[#494847] outline-none w-full"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-[#adaaaa] hover:text-white">
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#0e0e0e] border border-[#494847]/20 text-white text-xs rounded-lg px-3 py-2 outline-none cursor-pointer"
        >
          <option value="all">All Statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>

        <div className="flex gap-2 ml-auto">
          {/* Export CSV */}
          <button
            onClick={handleExport}
            title="Export CSV"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#a3a6ff] bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 rounded-lg hover:bg-[#a3a6ff]/20 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          {/* Refresh */}
          <button
            onClick={() => window.location.reload()}
            title="Refresh"
            className="p-2 text-[#adaaaa] hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left border-collapse">
          <thead>
            <tr className="bg-[#131313]">
              {["Tracking #", "Pickup", "Delivery", "Item", "Status", "Assigned Driver", "Date"].map((h, i) => (
                <th
                  key={h}
                  className={`px-5 py-4 text-[11px] uppercase tracking-widest font-bold text-[#adaaaa] ${i === 6 ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#494847]/5">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-[#adaaaa] text-sm">
                  {query || statusFilter !== "all" ? "No deliveries match your filters." : "No deliveries found."}
                </td>
              </tr>
            ) : (
              pageRows.map((delivery) => (
                <tr key={delivery.id} className="hover:bg-[#201f1f]/40 transition-colors group">
                  <td className="px-5 py-4 font-mono text-xs text-[#a3a6ff] whitespace-nowrap">
                    {delivery.tracking_number ?? `KV-${delivery.id.slice(0, 8).toUpperCase()}`}
                  </td>
                  <td className="px-5 py-4 text-sm text-white max-w-[160px]">
                    <span className="block truncate" title={delivery.pickup_address ?? ""}>{delivery.pickup_address ?? "—"}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-white max-w-[160px]">
                    <span className="block truncate" title={delivery.delivery_address ?? ""}>{delivery.delivery_address ?? "—"}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-[#adaaaa] max-w-[120px]">
                    <span className="block truncate" title={delivery.item_description ?? ""}>{delivery.item_description ?? "—"}</span>
                  </td>
                  <td className="px-5 py-4">
                    <DeliveryStatusPill status={delivery.status} />
                  </td>
                  <td className="px-5 py-4">
                    <AssignDriverDropdown
                      deliveryId={delivery.id}
                      currentDriverId={delivery.driver_id}
                      drivers={drivers}
                      disabled={FINAL_STATUSES.has(delivery.status)}
                    />
                  </td>
                  <td className="px-5 py-4 text-xs text-[#adaaaa] text-right whitespace-nowrap">
                    {new Date(delivery.created_at).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="px-6 py-4 bg-[#1a1919]/30 flex items-center justify-between gap-4">
        <span className="text-xs text-[#adaaaa]">
          {filtered.length === 0
            ? "No results"
            : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="px-3 py-1 text-xs bg-[#262626] rounded text-[#adaaaa] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const pg = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(safePage - 2, totalPages - 4)) + i
            return (
              <button
                key={pg}
                onClick={() => setPage(pg)}
                className={`px-3 py-1 text-xs rounded font-bold transition-colors ${
                  pg === safePage ? "bg-[#a3a6ff] text-[#0f00a4]" : "bg-[#262626] text-[#adaaaa] hover:text-white"
                }`}
              >
                {pg}
              </button>
            )
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="px-3 py-1 text-xs bg-[#262626] rounded text-[#adaaaa] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

function DeliveryStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    requested:  { label: "Requested",  className: "bg-[#c180ff]/10 text-[#c180ff] border-[#c180ff]/20"  },
    accepted:   { label: "Accepted",   className: "bg-[#a3a6ff]/10 text-[#a3a6ff] border-[#a3a6ff]/20"  },
    collected:  { label: "Collected",  className: "bg-[#a3a6ff]/10 text-[#a3a6ff] border-[#a3a6ff]/20"  },
    in_transit: { label: "In Transit", className: "bg-[#a3a6ff]/10 text-[#a3a6ff] border-[#a3a6ff]/20"  },
    delivered:  { label: "Delivered",  className: "bg-[#ffa5d9]/10 text-[#ffa5d9] border-[#ffa5d9]/20"  },
    cancelled:  { label: "Cancelled",  className: "bg-[#ff6e84]/10 text-[#ff6e84] border-[#ff6e84]/20"  },
  }
  const config = map[status] ?? { label: status, className: "bg-[#262626] text-[#adaaaa] border-transparent" }
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${config.className}`}>
      {config.label}
    </span>
  )
}
