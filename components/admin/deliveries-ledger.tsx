"use client"

import { useEffect, useState } from "react"
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

export function DeliveriesLedger({
  initialDeliveries,
  drivers = [],
}: {
  initialDeliveries: DeliveryRequest[]
  drivers?: DriverOption[]
}) {
  const [deliveries, setDeliveries] = useState<DeliveryRequest[]>(initialDeliveries)

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

  return (
    <div className="bg-[#1a1919]/60 backdrop-blur-xl border border-[#494847]/15 rounded-xl overflow-hidden">
      <div className="p-6 bg-[#1a1919]/50 flex justify-between items-center border-b border-[#494847]/10">
        <h3 className="font-headline font-bold text-lg text-white">Active Ledger</h3>
        <div className="flex gap-2">
          <button className="p-2 text-[#adaaaa] hover:text-white transition-colors">
            <span className="material-symbols-outlined">download</span>
          </button>
          <button className="p-2 text-[#adaaaa] hover:text-white transition-colors">
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left border-collapse">
          <thead>
            <tr className="bg-[#131313]">
              {["Pickup", "Delivery", "Item", "Status", "Assigned Driver", "Date"].map(
                (h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-4 text-[11px] uppercase tracking-widest font-bold text-[#adaaaa] ${
                      i === 5 ? "text-right" : ""
                    }`}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#494847]/5">
            {deliveries.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-[#adaaaa] text-sm">
                  No deliveries found
                </td>
              </tr>
            ) : (
              deliveries.map((delivery) => (
                <tr key={delivery.id} className="hover:bg-[#201f1f]/40 transition-colors group">
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
                  <td className="px-5 py-4 text-sm text-[#adaaaa] max-w-[120px]">
                    <span className="block truncate" title={delivery.item_description ?? ""}>
                      {delivery.item_description ?? "—"}
                    </span>
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
                    {new Date(delivery.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-4 bg-[#1a1919]/30 flex justify-between items-center">
        <span className="text-xs text-[#adaaaa]">Showing {deliveries.length} entries</span>
        <div className="flex gap-1">
          <button className="px-3 py-1 text-xs bg-[#262626] rounded text-[#adaaaa] hover:text-white transition-colors">
            Prev
          </button>
          <button className="px-3 py-1 text-xs bg-[#a3a6ff] text-[#0f00a4] rounded font-bold">1</button>
          <button className="px-3 py-1 text-xs bg-[#262626] rounded text-[#adaaaa] hover:text-white transition-colors">
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

function DeliveryStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    requested: { label: "Requested", className: "bg-[#c180ff]/10 text-[#c180ff] border-[#c180ff]/20" },
    accepted: { label: "Accepted", className: "bg-[#a3a6ff]/10 text-[#a3a6ff] border-[#a3a6ff]/20" },
    collected: { label: "Collected", className: "bg-[#a3a6ff]/10 text-[#a3a6ff] border-[#a3a6ff]/20" },
    in_transit: { label: "In Transit", className: "bg-[#a3a6ff]/10 text-[#a3a6ff] border-[#a3a6ff]/20" },
    delivered: { label: "Delivered", className: "bg-[#ffa5d9]/10 text-[#ffa5d9] border-[#ffa5d9]/20" },
    cancelled: { label: "Cancelled", className: "bg-[#ff6e84]/10 text-[#ff6e84] border-[#ff6e84]/20" },
  }
  const config = map[status] ?? {
    label: status,
    className: "bg-[#262626] text-[#adaaaa] border-transparent",
  }
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${config.className}`}>
      {config.label}
    </span>
  )
}
