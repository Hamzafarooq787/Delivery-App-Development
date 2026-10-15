"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
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
  service_type?: string | null
  shop_name?: string | null
}

const FINAL_STATUSES = new Set(["delivered", "cancelled"])

type ServiceFilter = "all" | "collect_and_deliver" | "buy_for_me"

export function DeliveriesLedger({
  initialDeliveries,
  drivers = [],
}: {
  initialDeliveries: DeliveryRequest[]
  drivers?: DriverOption[]
}) {
  const [deliveries, setDeliveries] = useState<DeliveryRequest[]>(initialDeliveries)
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all")

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("admin-delivery-requests")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "delivery_requests" },
        (payload) => {
          const next = payload.new as DeliveryRequest
          setDeliveries((prev) => {
            if (prev.some((d) => d.id === next.id)) return prev
            return [next, ...prev]
          })
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "delivery_requests" },
        (payload) => {
          const next = payload.new as DeliveryRequest
          setDeliveries((prev) =>
            prev.map((d) => (d.id === next.id ? { ...d, ...next } : d)),
          )
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "delivery_requests" },
        (payload) => {
          const old = payload.old as { id: string }
          setDeliveries((prev) => prev.filter((d) => d.id !== old.id))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const filtered = deliveries.filter((d) => {
    if (serviceFilter === "all") return true
    if (serviceFilter === "buy_for_me") return d.service_type === "buy_for_me"
    return d.service_type !== "buy_for_me"
  })

  return (
    <div className="bg-[var(--brand-panel)]/60 backdrop-blur-xl border border-[var(--color-outline-variant)]/15 rounded-xl overflow-hidden">
      <div className="p-6 bg-[var(--brand-panel)]/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[var(--color-outline-variant)]/10">
        <h3 className="font-headline font-bold text-lg text-white">Active Ledger</h3>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-[var(--color-outline-variant)]/20">
            {(["all", "collect_and_deliver", "buy_for_me"] as ServiceFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setServiceFilter(f)}
                className={`px-3 py-1.5 text-[11px] font-bold uppercase transition-colors ${
                  serviceFilter === f
                    ? f === "buy_for_me"
                      ? "bg-[var(--color-secondary)] text-[var(--brand-bg)]"
                      : "bg-[var(--brand-strong)] text-[var(--brand-ink)]"
                    : "bg-[var(--brand-panel)] text-[var(--color-on-surface-variant)] hover:text-white"
                }`}
              >
                {f === "all" ? "All" : f === "buy_for_me" ? "Buy for Me" : "C&D"}
              </button>
            ))}
          </div>
          <button className="p-2 text-[var(--color-on-surface-variant)] hover:text-white transition-colors">
            <span className="material-symbols-outlined">download</span>
          </button>
          <button className="p-2 text-[var(--color-on-surface-variant)] hover:text-white transition-colors">
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left border-collapse">
          <thead>
            <tr className="bg-[var(--brand-bg)]">
              {["Tracking #", "Pickup", "Delivery", "Item", "Status", "Assigned Driver", "Date", "Track"].map(
                (h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-4 text-[11px] uppercase tracking-widest font-bold text-[var(--color-on-surface-variant)] ${
                      i >= 6 ? "text-right" : ""
                    }`}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-outline-variant)]/5">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-[var(--color-on-surface-variant)] text-sm">
                  No deliveries found
                </td>
              </tr>
            ) : (
              filtered.map((delivery) => (
                <tr key={delivery.id} className="hover:bg-[var(--color-surface-container-high)]/40 transition-colors group">
                  <td className="px-5 py-4 font-mono text-xs text-[var(--brand-soft)] whitespace-nowrap">
                    <Link href={`/dashboard/admin/orders/${delivery.id}`} className="hover:underline">
                      {delivery.tracking_number ?? `KV-${delivery.id.slice(0, 8).toUpperCase()}`}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm text-white max-w-[160px]">
                    <span className="block truncate" title={delivery.pickup_address ?? ""}>
                      {delivery.pickup_address ?? "—"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-white max-w-[160px]">
                    <span className="block truncate" title={delivery.delivery_address ?? ""}>
                      {delivery.delivery_address ?? "—"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--color-on-surface-variant)] max-w-[160px]">
                    {delivery.service_type === "buy_for_me" ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border border-[var(--color-secondary)]/20 w-fit">
                          BFM
                        </span>
                        <span className="block truncate text-white" title={delivery.shop_name ?? ""}>
                          {delivery.shop_name ?? "Shopping"}
                        </span>
                      </div>
                    ) : (
                      <span className="block truncate" title={delivery.item_description ?? ""}>
                        {delivery.item_description ?? "—"}
                      </span>
                    )}
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
                  <td className="px-5 py-4 text-xs text-[var(--color-on-surface-variant)] text-right whitespace-nowrap">
                    {new Date(delivery.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <Link
                      href={`/dashboard/admin/orders/${delivery.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-soft)] hover:underline"
                    >
                      <span className="material-symbols-outlined text-base">
                        {FINAL_STATUSES.has(delivery.status) ? "visibility" : "my_location"}
                      </span>
                      {FINAL_STATUSES.has(delivery.status) ? "View" : "Track"}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-4 bg-[var(--brand-panel)]/30 flex justify-between items-center">
        <span className="text-xs text-[var(--color-on-surface-variant)]">Showing {filtered.length} of {deliveries.length} entries</span>
        <div className="flex gap-1">
          <button className="px-3 py-1 text-xs bg-[var(--color-surface-container-highest)] rounded text-[var(--color-on-surface-variant)] hover:text-white transition-colors">
            Prev
          </button>
          <button className="px-3 py-1 text-xs bg-[var(--brand-strong)] text-[var(--brand-ink)] rounded font-bold">1</button>
          <button className="px-3 py-1 text-xs bg-[var(--color-surface-container-highest)] rounded text-[var(--color-on-surface-variant)] hover:text-white transition-colors">
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

function DeliveryStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    requested: { label: "Requested", className: "bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border-[var(--color-secondary)]/20" },
    accepted: { label: "Accepted", className: "bg-[var(--brand-strong)]/10 text-[var(--brand-soft)] border-[var(--brand-strong)]/20" },
    collected: { label: "Collected", className: "bg-[var(--brand-strong)]/10 text-[var(--brand-soft)] border-[var(--brand-strong)]/20" },
    in_transit: { label: "In Transit", className: "bg-[var(--brand-strong)]/10 text-[var(--brand-soft)] border-[var(--brand-strong)]/20" },
    delivered: { label: "Delivered", className: "bg-[var(--color-tertiary)]/10 text-[var(--color-tertiary)] border-[var(--color-tertiary)]/20" },
    cancelled: { label: "Cancelled", className: "bg-[#ff6e84]/10 text-[#ff6e84] border-[#ff6e84]/20" },
  }
  const config = map[status] ?? {
    label: status,
    className: "bg-[var(--color-surface-container-highest)] text-[var(--color-on-surface-variant)] border-transparent",
  }
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${config.className}`}>
      {config.label}
    </span>
  )
}

