"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const GoogleMultiDriver = dynamic(
  () => import("@/components/maps/google-multi-driver").then((m) => m.GoogleMultiDriver),
  { ssr: false },
)

export type TrackedDelivery = {
  id: string
  tracking_number: string | null
  status: string
  driver_id: string | null
  driver_name: string | null
  customer_name: string | null
  pickup_address: string | null
  delivery_address: string | null
  pickup_lat: number | null
  pickup_lng: number | null
  delivery_lat: number | null
  delivery_lng: number | null
}

const STATUS_LABEL: Record<string, string> = {
  accepted: "Heading to pickup",
  collected: "Parcel collected",
  picked_up: "Parcel collected",
  in_transit: "In transit",
}

// Re-fetch the list of live deliveries so newly accepted/finished jobs appear without a manual reload.
const REFRESH_MS = 30_000

export function AdminLiveTrackingBoard({ deliveries }: { deliveries: TrackedDelivery[] }) {
  const router = useRouter()
  const [focusedId, setFocusedId] = useState<string | null>(deliveries[0]?.id ?? null)

  useEffect(() => {
    const t = setInterval(() => router.refresh(), REFRESH_MS)
    return () => clearInterval(t)
  }, [router])

  // Keep the focus valid when the list changes (a delivery finished or a new one appeared)
  const focused = deliveries.find((d) => d.id === focusedId) ?? deliveries[0] ?? null

  if (deliveries.length === 0) {
    return (
      <div className="bg-[#1a1919]/60 border border-[#494847]/15 rounded-xl py-20 text-center">
        <span className="material-symbols-outlined text-5xl text-[#494847]">my_location</span>
        <p className="text-white font-semibold mt-3">No deliveries on the road right now</p>
        <p className="text-[#adaaaa] text-sm mt-1">Accepted and in-transit deliveries will show up here live.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row bg-[#1a1919]/60 border border-[#494847]/15 rounded-xl overflow-hidden">
      <div className="flex-1 min-h-[320px] lg:min-h-[560px]">
        <GoogleMultiDriver
          deliveries={deliveries}
          focusedDeliveryId={focused?.id ?? null}
          height="100%"
          className="h-full w-full"
        />
      </div>
      <div
        className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-[#494847]/15 overflow-y-auto"
        style={{ maxHeight: 560 }}
      >
        <div className="px-4 py-3 border-b border-[#494847]/15">
          <p className="text-[10px] font-bold text-[#adaaaa] uppercase tracking-widest">
            {deliveries.length} active {deliveries.length === 1 ? "delivery" : "deliveries"}
          </p>
        </div>
        <div className="divide-y divide-[#494847]/10">
          {deliveries.map((d) => (
            <div
              key={d.id}
              className={`p-4 cursor-pointer transition-colors ${
                focused?.id === d.id ? "bg-[var(--color-primary)]/10" : "hover:bg-[#201f1f]"
              }`}
              onClick={() => setFocusedId(d.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-[var(--color-primary)]">
                  {d.tracking_number ?? `KV-${d.id.slice(0, 8).toUpperCase()}`}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#adaaaa]">
                  {STATUS_LABEL[d.status] ?? d.status}
                </span>
              </div>
              <p className="text-sm text-white mt-1">{d.driver_name ?? "No driver assigned"}</p>
              {d.customer_name && <p className="text-xs text-[#adaaaa]">Customer: {d.customer_name}</p>}
              <p className="text-xs text-[#adaaaa] mt-1 truncate" title={d.delivery_address ?? ""}>
                To: {d.delivery_address ?? "—"}
              </p>
              <Link
                href={`/dashboard/admin/orders/${d.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-block mt-2 text-xs font-bold text-[var(--color-primary)] hover:underline"
              >
                Order details →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

