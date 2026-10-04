import { createAdminClient } from "@/lib/supabase/admin"
import { AdminLiveTrackingBoard, type TrackedDelivery } from "@/components/admin/live-tracking-board"

export const dynamic = "force-dynamic"

// Statuses where a driver is on the job and broadcasting a live location.
const LIVE_STATUSES = ["accepted", "collected", "in_transit", "picked_up"]

export default async function AdminLiveTrackingPage() {
  const admin = createAdminClient()

  const { data: deliveries } = await admin
    .from("delivery_requests")
    .select(
      "id, tracking_number, status, driver_id, customer_id, pickup_address, delivery_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng, created_at",
    )
    .in("status", LIVE_STATUSES)
    .order("created_at", { ascending: false })

  const rows = deliveries ?? []
  const userIds = Array.from(
    new Set(rows.flatMap((d) => [d.driver_id, d.customer_id]).filter((id): id is string => !!id)),
  )

  const names: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: users } = await admin.from("users").select("id, full_name").in("id", userIds)
    for (const u of users ?? []) names[u.id] = u.full_name ?? ""
  }

  const tracked: TrackedDelivery[] = rows.map((d) => ({
    id: d.id,
    tracking_number: d.tracking_number,
    status: d.status,
    driver_id: d.driver_id,
    driver_name: d.driver_id ? names[d.driver_id] || "Driver" : null,
    customer_name: d.customer_id ? names[d.customer_id] || "Customer" : null,
    pickup_address: d.pickup_address,
    delivery_address: d.delivery_address,
    pickup_lat: d.pickup_lat != null ? Number(d.pickup_lat) : null,
    pickup_lng: d.pickup_lng != null ? Number(d.pickup_lng) : null,
    delivery_lat: d.delivery_lat != null ? Number(d.delivery_lat) : null,
    delivery_lng: d.delivery_lng != null ? Number(d.delivery_lng) : null,
  }))

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[#131313]">
      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-extrabold font-headline tracking-tight text-white">Live Tracking</h2>
        <p className="text-[#adaaaa] mt-1 text-sm">
          Every delivery that is on the road right now, with the driver&apos;s live position.
        </p>
      </div>
      <AdminLiveTrackingBoard deliveries={tracked} />
    </div>
  )
}
