import { createAdminClient } from "@/lib/supabase/admin"
import { RevenueChart } from "@/components/admin/revenue-chart"
import { OrderStatusChart } from "@/components/admin/order-status-chart"
import { ReportsExportButton } from "@/components/admin/reports-export-button"

export const dynamic = "force-dynamic"

export default async function AdminReportsPage() {
  const admin = createAdminClient()

  const [deliveriesRes, earningsRes, driversRes, customersRes, driverDeliveryCountsRes] = await Promise.all([
    admin.from("delivery_requests").select("id, status, created_at, price").order("created_at", { ascending: true }),
    admin.from("driver_earnings").select("amount, commission_amount, created_at"),
    // Top drivers by delivered count — fetch approved drivers with their profile info
    admin.from("driver_profiles").select("id, users(full_name, email)").eq("status", "approved").limit(10),
    admin
      .from("users")
      .select("id", { count: "exact" })
      .eq("role", "customer")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    // Count completed deliveries per driver
    admin
      .from("delivery_requests")
      .select("driver_id")
      .eq("status", "delivered")
      .not("driver_id", "is", null),
  ])

  const deliveries    = deliveriesRes.data ?? []
  const earnings      = earningsRes.data ?? []
  const driverProfiles = driversRes.data ?? []
  const newCustomers  = customersRes.count ?? 0
  const deliveredRows = driverDeliveryCountsRes.data ?? []

  // Count per driver
  const completedByDriver: Record<string, number> = {}
  for (const row of deliveredRows) {
    if (row.driver_id) completedByDriver[row.driver_id] = (completedByDriver[row.driver_id] ?? 0) + 1
  }

  // Build top-drivers list sorted by completed count
  const topDrivers = driverProfiles
    .map((dp: any) => {
      const u = Array.isArray(dp.users) ? dp.users[0] : dp.users
      return {
        id:        dp.id,
        full_name: u?.full_name ?? null,
        email:     u?.email    ?? null,
        completed: completedByDriver[dp.id] ?? 0,
      }
    })
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 5)

  const totalRevenue = earnings.length > 0
    ? earnings.reduce((s, e) => s + (e.amount ?? 0) + (e.commission_amount ?? 0), 0)
    : deliveries.reduce((s, d) => s + ((d as any).price ?? 0), 0)
  const activeDrivers = driverProfiles.length

  // Build daily chart data (last 7 days)
  const now = Date.now()
  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d        = new Date(now - (6 - i) * 86400000)
    const label    = d.toLocaleDateString("en-GB", { weekday: "short" })
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const dayEnd   = dayStart + 86400000
    const revenue  = earnings
      .filter((e) => { const t = new Date(e.created_at).getTime(); return t >= dayStart && t < dayEnd })
      .reduce((s, e) => s + (e.amount ?? 0) + (e.commission_amount ?? 0), 0)
    const orders   = deliveries.filter((d2) => {
      const t = new Date(d2.created_at).getTime()
      return t >= dayStart && t < dayEnd
    }).length
    return { label, revenue, orders }
  })

  // Status distribution
  const statusCounts: Record<string, number> = {}
  for (const d of deliveries) statusCounts[d.status] = (statusCounts[d.status] ?? 0) + 1
  const statusData = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

  // Compute real deltas vs previous period (30-day)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const sixtyDaysAgo  = Date.now() - 60 * 24 * 60 * 60 * 1000
  const recentOrders  = deliveries.filter((d) => new Date(d.created_at).getTime() >= thirtyDaysAgo).length
  const prevOrders    = deliveries.filter((d) => { const t = new Date(d.created_at).getTime(); return t >= sixtyDaysAgo && t < thirtyDaysAgo }).length
  const orderDeltaPct = prevOrders > 0 ? Math.round(((recentOrders - prevOrders) / prevOrders) * 100) : 0

  const recentRevenue = earnings.filter((e) => new Date(e.created_at).getTime() >= thirtyDaysAgo)
    .reduce((s, e) => s + (e.amount ?? 0) + (e.commission_amount ?? 0), 0)
  const prevRevenue   = earnings.filter((e) => { const t = new Date(e.created_at).getTime(); return t >= sixtyDaysAgo && t < thirtyDaysAgo })
    .reduce((s, e) => s + (e.amount ?? 0) + (e.commission_amount ?? 0), 0)
  const revDeltaPct   = prevRevenue > 0 ? Math.round(((recentRevenue - prevRevenue) / prevRevenue) * 100) : 0

  const REPORTS = [
    {
      label: "Orders (30d)",
      value: recentOrders.toString(),
      delta: `${orderDeltaPct >= 0 ? "+" : ""}${orderDeltaPct}%`,
      up: orderDeltaPct >= 0,
      icon: "local_shipping",
    },
    {
      label: "Revenue (30d)",
      value: `£${totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      delta: `${revDeltaPct >= 0 ? "+" : ""}${revDeltaPct}%`,
      up: revDeltaPct >= 0,
      icon: "payments",
    },
    {
      label: "Active Drivers",
      value: activeDrivers.toString(),
      delta: "Approved",
      up: true,
      icon: "directions_car",
    },
    {
      label: "New Customers",
      value: newCustomers.toString(),
      delta: "Last 30 days",
      up: true,
      icon: "group_add",
    },
  ]

  // Prepare export payload for the client button
  const exportPayload = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalOrders:    deliveries.length,
      recentOrders,
      totalRevenue:   totalRevenue.toFixed(2),
      activeDrivers,
      newCustomers,
    },
    daily7: days7,
    statusBreakdown: statusCounts,
    topDrivers: topDrivers.map((d) => ({ name: d.full_name ?? "Unknown", email: d.email ?? "", completed: d.completed })),
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[#131313]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-headline font-black tracking-tight text-white">Platform Analytics</h1>
          <p className="text-[#adaaaa] mt-2 text-sm">
            Live telemetry data — all insights since platform inception.
          </p>
        </div>
        <ReportsExportButton payload={exportPayload} />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-6 md:mb-8">
        {REPORTS.map((stat) => (
          <div key={stat.label} className="bg-[#1a1919] p-6 rounded-xl">
            <div className="flex items-start justify-between mb-4">
              <p className="text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold">{stat.label}</p>
              <span className="material-symbols-outlined text-[#a3a6ff] text-xl">{stat.icon}</span>
            </div>
            <p className="text-3xl font-extrabold font-headline text-white">{stat.value}</p>
            <div className="flex items-center gap-1 mt-2">
              <span className={`material-symbols-outlined text-[10px] ${stat.up ? "text-[#a3a6ff]" : "text-[#ff6e84]"}`}>
                {stat.up ? "arrow_upward" : "arrow_downward"}
              </span>
              <span className={`text-xs font-bold ${stat.up ? "text-[#a3a6ff]" : "text-[#ff6e84]"}`}>{stat.delta}</span>
              <span className="text-[10px] text-[#adaaaa]">vs. last period</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6 mb-6 md:mb-8">
        <div className="col-span-1 lg:col-span-8 bg-[#1a1919] p-5 md:p-6 rounded-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-white font-headline">Revenue Momentum</h3>
              <p className="text-[#adaaaa] text-xs">Weekly earnings in GBP (£)</p>
            </div>
            <span className="text-[10px] text-[#a3a6ff] bg-[#a3a6ff]/10 px-3 py-1 rounded-full font-bold">7-Day Window</span>
          </div>
          <RevenueChart data={days7} />
        </div>
        <div className="col-span-1 lg:col-span-4 bg-[#1a1919] p-5 md:p-6 rounded-xl">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white font-headline">Delivery Status</h3>
            <p className="text-[#adaaaa] text-xs">Breakdown by state</p>
          </div>
          <OrderStatusChart data={statusData} />
        </div>
      </div>

      {/* Top Drivers Table — real completion counts */}
      <div className="bg-[#1a1919] rounded-xl overflow-hidden">
        <div className="px-6 md:px-8 py-5 border-b border-[#494847]/10 flex items-center justify-between">
          <h3 className="text-base font-bold text-white font-headline">Top Field Agents</h3>
          <a href="/dashboard/admin/drivers" className="text-xs text-[#a3a6ff] hover:underline">View All</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[480px]">
            <thead>
              <tr className="bg-[#201f1f] text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold">
                <th className="px-8 py-4">Rank</th>
                <th className="px-8 py-4">Agent</th>
                <th className="px-8 py-4 text-right">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#494847]/5">
              {topDrivers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-[#adaaaa] text-sm">No driver data available</td>
                </tr>
              ) : (
                topDrivers.map((driver, i) => (
                  <tr key={driver.id} className="hover:bg-[#201f1f] transition-colors">
                    <td className="px-8 py-5">
                      <span className={`text-xs font-extrabold font-headline ${i === 0 ? "text-[#a3a6ff]" : i === 1 ? "text-[#c180ff]" : "text-[#adaaaa]"}`}>
                        #{i + 1}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#a3a6ff]/10 flex items-center justify-center text-[#a3a6ff] text-xs font-bold">
                          {(driver.full_name ?? driver.email ?? "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-sm font-semibold">{driver.full_name ?? "Unknown"}</p>
                          <p className="text-[#adaaaa] text-[10px]">{driver.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="text-white font-bold text-sm">{driver.completed}</span>
                      <span className="text-[#adaaaa] text-xs ml-1">deliveries</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
