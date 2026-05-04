import { createClient } from "@/lib/supabase/server"

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    ordersRes,
    paymentsRes,
    activeDriversRes,
    disputesRes,
    recentOrdersRes,
    pendingDriversRes,
  ] = await Promise.all([
    supabase.from("delivery_requests").select("id", { count: "exact" }),
    supabase.from("payments").select("amount").eq("status", "succeeded"),
    supabase.from("driver_profiles").select("id", { count: "exact" }).eq("status", "approved"),
    supabase.from("disputes").select("id", { count: "exact" }).eq("status", "open"),
    supabase
      .from("delivery_requests")
      .select("id, tracking_number, status, price, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("driver_profiles")
      .select("id, created_at, users(full_name)")
      .eq("status", "pending")
      .limit(3),
  ])

  const revenue = paymentsRes.data?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0

  const stats = [
    {
      label: "Daily Revenue",
      value: `$${revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      delta: "+12.4% vs yesterday",
      deltaUp: true,
      icon: "payments",
      iconColor: "text-[#a3a6ff]",
      iconBg: "bg-[#a3a6ff]/10",
    },
    {
      label: "Total Deliveries",
      value: String(ordersRes.count ?? 0),
      delta: "-2.1% from peak",
      deltaUp: false,
      icon: "package_2",
      iconColor: "text-[#adaaaa]",
      iconBg: "bg-[#adaaaa]/10",
    },
    {
      label: "Active Drivers",
      value: String(activeDriversRes.count ?? 0),
      delta: "Live Now",
      deltaUp: true,
      icon: "charging_station",
      iconColor: "text-[#ffa5d9]",
      iconBg: "bg-[#ffa5d9]/10",
    },
    {
      label: "Open Disputes",
      value: String(disputesRes.count ?? 0),
      delta: "Needs attention",
      deltaUp: false,
      icon: "gavel",
      iconColor: "text-[#c180ff]",
      iconBg: "bg-[#c180ff]/10",
    },
  ]

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[#131313]">
      {/* Page Header */}
      <div className="mb-6 md:mb-8">
        <h2 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          Overview <span className="text-[#a3a6ff]">&amp;</span> Analytics
        </h2>
        <p className="text-[#adaaaa] mt-2 text-sm">Real-time throughput and kinetic performance metrics.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[#1a1919]/60 backdrop-blur-xl border border-[#494847]/15 p-6 rounded-xl relative overflow-hidden group"
          >
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-[#adaaaa] text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                <h3 className="font-headline text-4xl font-bold text-[#a3a6ff]">{stat.value}</h3>
                <p className={`text-xs mt-2 flex items-center font-bold ${stat.deltaUp ? "text-[#c180ff]" : "text-[#ff6e84]"}`}>
                  <span className="material-symbols-outlined text-sm mr-1">
                    {stat.deltaUp ? "trending_up" : "trending_down"}
                  </span>
                  {stat.delta}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full ${stat.iconBg} flex items-center justify-center ${stat.iconColor}`}>
                <span className="material-symbols-outlined">{stat.icon}</span>
              </div>
            </div>
            {/* Subtle area chart */}
            <div className="absolute bottom-0 left-0 w-full h-16 opacity-20 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 400 60" preserveAspectRatio="none">
                <path
                  d="M0 50 Q 50 10, 100 35 T 200 20 T 300 40 T 400 15 V 60 H 0 Z"
                  fill="#a3a6ff"
                  fillOpacity="0.4"
                />
              </svg>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column */}
        <div className="col-span-1 lg:col-span-8 space-y-6">
          {/* Revenue Velocity (Mock Bar Chart) */}
          <div className="bg-[#1a1919] rounded-xl p-5 md:p-8 relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-xl font-bold font-headline text-white">Revenue Velocity</h4>
                <p className="text-[#adaaaa] text-sm">Aggregated earnings across all logistic sectors</p>
              </div>
              <button className="text-[#adaaaa] hover:text-white">
                <span className="material-symbols-outlined">more_vert</span>
              </button>
            </div>
            <div className="h-48 flex items-end justify-between gap-2 relative">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="w-full h-px bg-white" />
                ))}
              </div>
              {[
                { h: "h-32", color: "bg-[#a3a6ff]/20" },
                { h: "h-20", color: "bg-[#a3a6ff]/20" },
                { h: "h-44", color: "bg-[#a3a6ff]/20" },
                { h: "h-28", color: "bg-[#a3a6ff]/20" },
                { h: "h-48", color: "bg-[#c180ff]/40", highlight: true },
                { h: "h-36", color: "bg-[#a3a6ff]/20" },
                { h: "h-24", color: "bg-[#a3a6ff]/20" },
              ].map((bar, i) => (
                <div
                  key={i}
                  className={`w-full ${bar.h} ${bar.color} rounded-t-lg relative group transition-all hover:brightness-125 ${bar.highlight ? "shadow-[0px_0px_15px_rgba(163,166,255,0.2)]" : ""}`}
                >
                  <div className={`absolute inset-x-0 bottom-0 h-full bg-gradient-to-t ${bar.highlight ? "from-[#c180ff]/60" : "from-[#a3a6ff]/40"} to-transparent`} />
                  {bar.highlight && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#262626]/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity text-white whitespace-nowrap">
                      ${(revenue / 7).toFixed(0)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between text-[10px] font-bold text-[#adaaaa] uppercase tracking-widest px-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri (Today)", "Sat", "Sun"].map((day, i) => (
                <span key={day} className={i === 4 ? "text-[#c180ff]" : ""}>{day}</span>
              ))}
            </div>
          </div>

          {/* Pending Driver Approvals */}
          <div className="bg-[#1a1919] rounded-xl overflow-hidden">
            <div className="p-6 flex justify-between items-center">
              <h4 className="font-headline text-lg font-bold text-white">Pending Driver Approvals</h4>
              <button className="text-[#a3a6ff] text-xs font-bold uppercase tracking-widest hover:underline transition-all">
                View All
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#201f1f]/50 text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold">
                  <tr>
                    <th className="px-6 py-4">Driver Name</th>
                    <th className="px-6 py-4">Fleet Class</th>
                    <th className="px-6 py-4">Applied Date</th>
                    <th className="px-6 py-4">Background Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#494847]/10">
                  {(pendingDriversRes.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-[#adaaaa] text-sm">
                        No pending applications
                      </td>
                    </tr>
                  ) : (
                    (pendingDriversRes.data ?? []).map((driver: any) => (
                      <tr key={driver.id} className="hover:bg-[#201f1f] transition-colors group">
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#262626] flex items-center justify-center font-bold text-xs text-white">
                            {(driver.users?.full_name ?? "?").slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-white">{driver.users?.full_name ?? "Unknown"}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#adaaaa]">Last Mile</td>
                        <td className="px-6 py-4 text-sm text-[#adaaaa]">
                          {new Date(driver.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#a3a6ff]/10 text-[#a3a6ff] uppercase">
                            Pending
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-2 text-[#a3a6ff] hover:bg-[#a3a6ff]/10 rounded-lg transition-colors">
                            <span className="material-symbols-outlined text-lg">check_circle</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-[#1a1919] rounded-xl overflow-hidden">
            <div className="p-6 flex justify-between items-center">
              <h4 className="font-headline text-lg font-bold text-white">Recent Orders</h4>
              <button className="text-[#a3a6ff] text-xs font-bold uppercase tracking-widest hover:underline transition-all">
                View All
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#201f1f]/50 text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold">
                  <tr>
                    <th className="px-6 py-4">Tracking #</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#494847]/10">
                  {(recentOrdersRes.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-[#adaaaa] text-sm">No orders yet</td>
                    </tr>
                  ) : (
                    (recentOrdersRes.data ?? []).map((order) => (
                      <tr key={order.id} className="hover:bg-[#201f1f] transition-colors">
                        <td className="px-6 py-4 font-mono text-sm text-[#a3a6ff]">{order.tracking_number}</td>
                        <td className="px-6 py-4">
                          <StatusPill status={order.status} />
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-white">
                          ${(order.price ?? 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#adaaaa] whitespace-nowrap">
                          {new Date(order.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column: Activity Feed */}
        <div className="col-span-1 lg:col-span-4">
          <div className="bg-[#1a1919]/60 backdrop-blur-xl border border-[#494847]/15 rounded-xl h-full flex flex-col">
            <div className="p-6 border-b border-[#494847]/10">
              <h4 className="font-headline text-lg font-bold text-white">Activity Feed</h4>
              <p className="text-[#adaaaa] text-[11px] uppercase tracking-widest mt-1">Live HQ Updates</p>
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-8">
              {[
                {
                  dot: "bg-[#a3a6ff]",
                  dotBg: "bg-[#a3a6ff]/20",
                  pulse: true,
                  title: "Route #KV-821 Optimized",
                  body: "System calculated 14% fuel reduction for Northwest sector fleet.",
                  time: "2 mins ago",
                },
                {
                  dot: null,
                  dotBg: "bg-[#201f1f]",
                  pulse: false,
                  title: "Weather Alert: Chicago",
                  body: "Severe thunderstorms predicted. 12 shipments rerouted to Hub-B.",
                  time: "45 mins ago",
                  icon: "info",
                },
                {
                  dot: "bg-[#c180ff]",
                  dotBg: "bg-[#c180ff]/20",
                  pulse: false,
                  title: "New Performance High",
                  body: 'Carrier "Velocity-9" achieved 99.8% on-time delivery rate this week.',
                  time: "1 hour ago",
                },
                {
                  dot: null,
                  dotBg: "bg-[#201f1f]",
                  pulse: false,
                  title: "Audit Log Exported",
                  body: "Weekly compliance report generated by System Admin.",
                  time: "3 hours ago",
                  icon: "history",
                },
              ].map((feed, i) => (
                <div key={i} className="flex gap-4 relative">
                  {i < 3 && (
                    <div className="absolute left-[11px] top-6 bottom-[-32px] w-[1px] border-l border-dashed border-[#494847]" />
                  )}
                  <div className={`w-6 h-6 rounded-full ${feed.dotBg} flex items-center justify-center relative z-10 shrink-0`}>
                    {feed.dot ? (
                      <div className={`w-2 h-2 ${feed.dot} rounded-full ${feed.pulse ? "animate-pulse shadow-[0_0_8px_rgba(163,166,255,0.8)]" : "shadow-[0_0_8px_rgba(193,128,255,0.8)]"}`} />
                    ) : (
                      <span className="material-symbols-outlined text-[14px] text-[#adaaaa]">{feed.icon}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{feed.title}</p>
                    <p className="text-xs text-[#adaaaa] mt-1 leading-relaxed">{feed.body}</p>
                    <span className="text-[10px] text-[#adaaaa]/60 font-bold mt-2 inline-block uppercase">{feed.time}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Fleet Load */}
            <div className="p-6 border-t border-[#494847]/10">
              <h5 className="text-xs font-bold font-headline text-white mb-4 uppercase tracking-widest">Fleet Load</h5>
              <div className="space-y-4">
                {[
                  { label: "Autonomous Drones", pct: 88, color: "bg-[#a3a6ff]" },
                  { label: "Heavy Logistics", pct: 42, color: "bg-[#c180ff]" },
                  { label: "Local Couriers", pct: 65, color: "bg-[#ffa5d9]" },
                ].map((bar) => (
                  <div key={bar.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-white">{bar.label}</span>
                      <span className="text-[#adaaaa]">{bar.pct}%</span>
                    </div>
                    <div className="h-1 w-full bg-[#262626] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${bar.color} rounded-full`}
                        style={{ width: `${bar.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    completed: { label: "Completed", className: "bg-[#ffa5d9]/10 text-[#ffa5d9]" },
    pending: { label: "Pending", className: "bg-[#c180ff]/10 text-[#c180ff]" },
    in_transit: { label: "In Transit", className: "bg-[#a3a6ff]/10 text-[#a3a6ff]" },
    cancelled: { label: "Cancelled", className: "bg-[#ff6e84]/10 text-[#ff6e84]" },
  }
  const config = map[status] ?? { label: status, className: "bg-[#262626] text-[#adaaaa]" }
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${config.className}`}>
      {config.label}
    </span>
  )
}
