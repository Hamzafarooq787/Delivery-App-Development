import { createAdminClient } from "@/lib/supabase/admin"
import { DeliveriesLedger } from "@/components/admin/deliveries-ledger"

export default async function AdminOrdersPage() {
  const admin = createAdminClient()

  const [deliveriesRes, activeRes, successRes, driverProfilesRes] = await Promise.all([
    admin
      .from("delivery_requests")
      .select("*")
      .order("created_at", { ascending: false }),
    admin
      .from("delivery_requests")
      .select("id", { count: "exact" })
      .in("status", ["requested", "accepted", "collected", "in_transit"]),
    admin
      .from("delivery_requests")
      .select("id", { count: "exact" })
      .eq("status", "delivered"),
    // Fetch approved driver IDs
    admin
      .from("driver_profiles")
      .select("id")
      .eq("status", "approved"),
  ])

  const initialDeliveries = deliveriesRes.data ?? []
  const activeCount = activeRes.count ?? 0
  const successCount = successRes.count ?? 0
  const total = initialDeliveries.length

  // Resolve approved driver names from public.users
  const approvedIds = (driverProfilesRes.data ?? []).map((p) => p.id)
  let drivers: { id: string; full_name: string }[] = []
  if (approvedIds.length > 0) {
    const { data: driverUsers } = await admin
      .from("users")
      .select("id, full_name")
      .in("id", approvedIds)
    drivers = (driverUsers ?? []).map((u) => ({
      id: u.id,
      full_name: u.full_name ?? "Unknown Driver",
    }))
  }

  const successRate =
    successCount + total > 0
      ? ((successCount / (successCount + total)) * 100).toFixed(1)
      : "99.8"

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[#131313]">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold font-headline tracking-tight text-white">
            Deliveries Management
          </h2>
          <p className="text-[#adaaaa] mt-1 text-sm">
            Live oversight of active logistical threads within the kinetic void.
          </p>
        </div>
        <p className="text-xs text-[#adaaaa] bg-[#1a1919] border border-[#494847]/10 px-3 py-2 rounded-lg">
          Use the search and filter controls below
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-6 md:mb-8">
        <div className="col-span-1 lg:col-span-8 bg-[#1a1919]/60 backdrop-blur-xl border border-[#494847]/15 p-5 md:p-6 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-6 sm:gap-12">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold mb-2">Active Shipments</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl md:text-4xl font-extrabold font-headline text-[#a3a6ff]">
                  {activeCount.toLocaleString()}
                </span>
                <span className="text-[#c180ff] text-xs font-semibold">Live</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold mb-2">Average Speed</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl md:text-4xl font-extrabold font-headline text-white">14.2</span>
                <span className="text-[#adaaaa] text-xs font-semibold">min/km</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold mb-2">Success Rate</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl md:text-4xl font-extrabold font-headline text-white">{successRate}%</span>
              </div>
            </div>
          </div>
          <div className="hidden xl:flex items-end gap-1 h-16">
            {[67, 50, 75, 40, 80, 100].map((h, i) => (
              <div
                key={i}
                className="w-2 rounded-t-sm"
                style={{
                  height: `${h}%`,
                  backgroundColor: `rgba(163, 166, 255, ${0.2 + i * 0.16})`,
                }}
              />
            ))}
          </div>
        </div>
        <div className="col-span-1 lg:col-span-4 bg-[#a3a6ff] text-[#0f00a4] p-6 rounded-xl relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[10px] uppercase tracking-widest font-bold mb-2 opacity-80">Premium Logistics</p>
            <h3 className="text-2xl font-bold font-headline leading-tight">
              Zero-Latency
              <br />
              Priority Routing
            </h3>
            <p className="text-sm mt-2 opacity-90">Activated for {activeCount} deliveries.</p>
          </div>
          <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-8xl opacity-10 group-hover:scale-110 transition-transform">
            bolt
          </span>
        </div>
      </div>

      <DeliveriesLedger initialDeliveries={initialDeliveries} drivers={drivers} />
    </div>
  )
}
