import { createClient } from "@/lib/supabase/server"

export default async function AdminOrdersPage() {
  const supabase = await createClient()

  const [ordersRes, activeRes, successRes] = await Promise.all([
    supabase
      .from("delivery_requests")
      .select("id, tracking_number, status, price, created_at, customer_id")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("delivery_requests")
      .select("id", { count: "exact" })
      .in("status", ["pending", "in_transit", "accepted"]),
    supabase
      .from("delivery_requests")
      .select("id", { count: "exact" })
      .eq("status", "completed"),
  ])

  const orders = ordersRes.data ?? []
  const activeCount = activeRes.count ?? 0
  const successCount = successRes.count ?? 0
  const total = orders.length

  const successRate =
    successCount + total > 0
      ? ((successCount / (successCount + total)) * 100).toFixed(1)
      : "99.8"

  return (
    <div className="px-8 py-8 min-h-screen bg-[#131313]">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-extrabold font-headline tracking-tight text-white">
            Deliveries Management
          </h2>
          <p className="text-[#adaaaa] mt-1 text-sm">
            Live oversight of active logistical threads within the kinetic void.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-[#201f1f] text-white rounded-lg text-sm border border-[#494847]/10 hover:bg-[#262626] transition-all">
            <span className="material-symbols-outlined text-sm">filter_list</span>
            Filters
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#201f1f] text-white rounded-lg text-sm border border-[#494847]/10 hover:bg-[#262626] transition-all">
            <span className="material-symbols-outlined text-sm">calendar_month</span>
            Date Range
          </button>
        </div>
      </div>

      {/* Analytics Quick View */}
      <div className="grid grid-cols-12 gap-6 mb-8">
        <div className="col-span-12 lg:col-span-8 bg-[#1a1919]/60 backdrop-blur-xl border border-[#494847]/15 p-6 rounded-xl flex items-center justify-between">
          <div className="flex gap-12">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold mb-2">Active Shipments</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold font-headline text-[#a3a6ff]">
                  {activeCount.toLocaleString()}
                </span>
                <span className="text-[#c180ff] text-xs font-semibold">Live</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold mb-2">Average Speed</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold font-headline text-white">14.2</span>
                <span className="text-[#adaaaa] text-xs font-semibold">min/km</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold mb-2">Success Rate</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold font-headline text-white">{successRate}%</span>
              </div>
            </div>
          </div>
          {/* Sparkline */}
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
        <div className="col-span-12 lg:col-span-4 bg-[#a3a6ff] text-[#0f00a4] p-6 rounded-xl relative overflow-hidden group">
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

      {/* Data Table */}
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
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#131313]">
                {["Delivery ID", "Customer", "Driver", "Route", "Status", "Price", "Date"].map((h, i) => (
                  <th
                    key={h}
                    className={`px-6 py-4 text-[11px] uppercase tracking-widest font-bold text-[#adaaaa] ${i === 5 || i === 6 ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#494847]/5">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[#adaaaa] text-sm">
                    No deliveries found
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#201f1f]/40 transition-colors group">
                    <td className="px-6 py-5 font-mono text-sm text-[#a3a6ff]">
                      {order.tracking_number ?? `#KV-${order.id.slice(0, 5).toUpperCase()}`}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-[#262626] flex items-center justify-center text-xs font-bold text-white">
                          {String(order.customer_id ?? "?").slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-white">Customer</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm text-[#adaaaa]">Assigned</td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-white">Origin</span>
                        <span className="material-symbols-outlined text-[12px] text-[#adaaaa]">arrow_forward</span>
                        <span className="text-white">Destination</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <DeliveryStatusPill status={order.status} />
                    </td>
                    <td className="px-6 py-5 text-sm font-mono text-right text-white">
                      ${(order.price ?? 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-5 text-xs text-[#adaaaa] text-right whitespace-nowrap">
                      {new Date(order.created_at).toLocaleDateString("en-US", {
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
          <span className="text-xs text-[#adaaaa]">Showing {orders.length} entries</span>
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
    </div>
  )
}

function DeliveryStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    in_transit: { label: "In Transit", className: "bg-[#a3a6ff]/10 text-[#a3a6ff] border-[#a3a6ff]/20" },
    pending: { label: "Requested", className: "bg-[#c180ff]/10 text-[#c180ff] border-[#c180ff]/20" },
    completed: { label: "Delivered", className: "bg-[#ffa5d9]/10 text-[#ffa5d9] border-[#ffa5d9]/20" },
    cancelled: { label: "Cancelled", className: "bg-[#ff6e84]/10 text-[#ff6e84] border-[#ff6e84]/20" },
    accepted: { label: "Accepted", className: "bg-[#a3a6ff]/10 text-[#a3a6ff] border-[#a3a6ff]/20" },
  }
  const config = map[status] ?? { label: status, className: "bg-[#262626] text-[#adaaaa] border-transparent" }
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${config.className}`}>
      {config.label}
    </span>
  )
}
