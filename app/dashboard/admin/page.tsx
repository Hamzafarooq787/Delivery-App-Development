import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { VEHICLE_INFO, isVehicleType } from "@/lib/vehicles"

export const dynamic = "force-dynamic"

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

type FeedItem = {
  id: string
  title: string
  body: string
  time: string
  rawTime: string
  dot: string | null
  dotBg: string
  icon?: string
  pulse: boolean
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const admin    = createAdminClient()

  const [
    earningsRes,           // driver_earnings → commission/payout KPIs
    deliveredPricesRes,    // delivered delivery_requests → fallback gross revenue
    driverProfilesRes,     // all driver_profiles → fleet stats + approval rate
    disputesCountRes,      // open disputes count
    recentOrdersRes,       // last 8 orders → Recent Orders table (full data)
    pendingDriversRes,     // pending drivers → Approval table (full data)
    chartDeliveriesRes,    // last-7-days delivery_requests → Revenue chart
    allDeliveryStatusesRes,// all delivery statuses → fleet completion/active rates
    statusLogsRes,         // recent status_logs → activity feed (delivery events)
    disputesFeedRes,       // recent disputes → activity feed
    payoutsFeedRes,        // recent payouts → activity feed
  ] = await Promise.all([
    admin
      .from("driver_earnings")
      .select("amount, commission_amount"),

    admin
      .from("delivery_requests")
      .select("price")
      .eq("status", "delivered")
      .not("price", "is", null),

    admin
      .from("driver_profiles")
      .select("id, status"),

    admin
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),

    // Full order data: addresses, item info, customer & driver ids
    admin
      .from("delivery_requests")
      .select("id, tracking_number, status, price, created_at, pickup_address, delivery_address, item_description, customer_id, driver_id")
      .order("created_at", { ascending: false })
      .limit(8),

    // Full driver profile data including vehicles and user details
    admin
      .from("driver_profiles")
      .select("id, created_at, users(full_name, phone), driver_vehicles(vehicle_type, registration_number, make, model)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),

    admin
      .from("delivery_requests")
      .select("price, created_at, status")
      .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),

    admin
      .from("delivery_requests")
      .select("status"),

    admin
      .from("delivery_status_logs")
      .select("id, status, created_at, delivery_requests(tracking_number)")
      .order("created_at", { ascending: false })
      .limit(10),

    admin
      .from("disputes")
      .select("id, issue, created_at")
      .order("created_at", { ascending: false })
      .limit(5),

    admin
      .from("payouts")
      .select("id, amount, status, created_at, users(full_name)")
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  // ── Resolve customer & driver names for recent orders ─────────────────────
  const recentOrders = recentOrdersRes.data ?? []
  const userIdsNeeded = [
    ...new Set([
      ...recentOrders.map(o => o.customer_id).filter(Boolean),
      ...recentOrders.map(o => o.driver_id).filter(Boolean),
    ])
  ] as string[]

  const userNameMap: Record<string, string> = {}
  if (userIdsNeeded.length > 0) {
    const { data: userRows } = await admin
      .from("users")
      .select("id, full_name")
      .in("id", userIdsNeeded)
    for (const u of userRows ?? []) {
      userNameMap[u.id] = u.full_name ?? "Unknown"
    }
  }

  // ── Revenue KPIs ──────────────────────────────────────────────────────────

  const earnings           = earningsRes.data ?? []
  const totalCommission    = earnings.reduce((s, e) => s + (e.commission_amount ?? 0), 0)
  const totalDriverPayouts = earnings.reduce((s, e) => s + (e.amount ?? 0), 0)
  const grossFromEarnings  = totalCommission + totalDriverPayouts

  // Fallback: sum delivered delivery prices when driver_earnings is sparse
  const deliveredTotal = (deliveredPricesRes.data ?? []).reduce((s, d) => s + (d.price ?? 0), 0)
  const grossRevenue   = grossFromEarnings > 0 ? grossFromEarnings : deliveredTotal
  const commission     = grossFromEarnings > 0 ? totalCommission    : Math.round(deliveredTotal * 0.25 * 100) / 100
  const driverPayouts  = grossFromEarnings > 0 ? totalDriverPayouts : Math.round(deliveredTotal * 0.75 * 100) / 100
  const openDisputes   = disputesCountRes.count ?? 0

  const stats = [
    {
      label: "Gross Revenue",
      value: fmt(grossRevenue),
      delta: "All completed fares",
      deltaUp: true,
      icon: "payments",
      iconColor: "text-[var(--color-primary)]",
      iconBg: "bg-[var(--color-primary)]/10",
    },
    {
      label: "Platform Commission",
      value: fmt(commission),
      delta: "25% of all fares",
      deltaUp: true,
      icon: "account_balance",
      iconColor: "text-[var(--color-secondary)]",
      iconBg: "bg-[var(--color-secondary)]/10",
    },
    {
      label: "Driver Payouts",
      value: fmt(driverPayouts),
      delta: "75% share to drivers",
      deltaUp: true,
      icon: "local_shipping",
      iconColor: "text-[#6ee7b7]",
      iconBg: "bg-[#6ee7b7]/10",
    },
    {
      label: "Open Disputes",
      value: String(openDisputes),
      delta: openDisputes > 0 ? "Needs attention" : "All clear",
      deltaUp: openDisputes === 0,
      icon: "gavel",
      iconColor: openDisputes > 0 ? "text-[#ff6e84]" : "text-[#6ee7b7]",
      iconBg: openDisputes > 0 ? "bg-[#ff6e84]/10" : "bg-[#6ee7b7]/10",
    },
  ]

  // ── Revenue Velocity Chart (last 7 days) ──────────────────────────────────

  const chartDeliveries = chartDeliveriesRes.data ?? []

  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d        = new Date(Date.now() - (6 - i) * 86_400_000)
    const label    = d.toLocaleDateString("en-GB", { weekday: "short" })
    const isToday  = i === 6
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const dayEnd   = dayStart + 86_400_000
    const dayRev   = chartDeliveries
      .filter(r => {
        const t = new Date(r.created_at).getTime()
        return t >= dayStart && t < dayEnd && r.price
      })
      .reduce((s, r) => s + (r.price ?? 0), 0)
    return { label, revenue: dayRev, isToday }
  })

  const maxRev   = Math.max(...days7.map(d => d.revenue), 0.01)
  const chartBars = days7.map(d => ({
    ...d,
    heightPct: Math.max(Math.round((d.revenue / maxRev) * 100), 4),
  }))

  // ── Activity Feed ─────────────────────────────────────────────────────────

  const STATUS_CFG: Record<string, { mkTitle: (tn: string) => string; mkBody: (tn: string) => string; dot: string; dotBg: string; pulse: boolean }> = {
    requested:  { mkTitle: () => "New delivery requested",    mkBody: tn => `Order ${tn} added to queue`,              dot: "bg-[var(--color-secondary)]", dotBg: "bg-[var(--color-secondary)]/20", pulse: true  },
    accepted:   { mkTitle: () => "Driver accepted job",       mkBody: tn => `Order ${tn} — heading to pickup`,         dot: "bg-[var(--color-primary)]", dotBg: "bg-[var(--color-primary)]/20", pulse: false },
    collected:  { mkTitle: () => "Parcel collected",          mkBody: tn => `Order ${tn} — parcel authenticated`,      dot: "bg-[var(--color-primary)]", dotBg: "bg-[var(--color-primary)]/20", pulse: false },
    in_transit: { mkTitle: () => "En route to delivery",      mkBody: tn => `Order ${tn} is in transit`,               dot: "bg-[var(--color-primary)]", dotBg: "bg-[var(--color-primary)]/20", pulse: true  },
    delivered:  { mkTitle: () => "Delivery completed ✓",      mkBody: tn => `Order ${tn} successfully delivered`,      dot: "bg-[#6ee7b7]", dotBg: "bg-[#6ee7b7]/20", pulse: false },
    cancelled:  { mkTitle: () => "Delivery cancelled",        mkBody: tn => `Order ${tn} was cancelled`,               dot: "bg-[#ff6e84]", dotBg: "bg-[#ff6e84]/20", pulse: false },
  }

  const feedItems: FeedItem[] = []

  for (const log of (statusLogsRes.data ?? [])) {
    const dr  = log.delivery_requests as any
    const tn  = Array.isArray(dr) ? (dr[0]?.tracking_number ?? "—") : (dr?.tracking_number ?? "—")
    const cfg = STATUS_CFG[log.status]
    if (cfg) {
      feedItems.push({
        id:      `log-${log.id}`,
        title:   cfg.mkTitle(tn),
        body:    cfg.mkBody(tn),
        time:    relTime(log.created_at),
        rawTime: log.created_at,
        dot:     cfg.dot,
        dotBg:   cfg.dotBg,
        pulse:   cfg.pulse,
      })
    }
  }

  for (const d of (disputesFeedRes.data ?? [])) {
    feedItems.push({
      id:      `dispute-${d.id}`,
      title:   "New dispute opened",
      body:    d.issue ? (d.issue.length > 60 ? d.issue.slice(0, 60) + "…" : d.issue) : "Customer raised a dispute",
      time:    relTime(d.created_at),
      rawTime: d.created_at,
      dot:     "bg-[#ff6e84]",
      dotBg:   "bg-[#ff6e84]/20",
      pulse:   false,
    })
  }

  for (const p of (payoutsFeedRes.data ?? [])) {
    const u    = p.users as any
    const name = Array.isArray(u) ? (u[0]?.full_name ?? "Driver") : (u?.full_name ?? "Driver")
    const paid = p.status === "paid"
    feedItems.push({
      id:      `payout-${p.id}`,
      title:   paid ? "Payout disbursed" : "Payout requested",
      body:    `${name} — ${fmt(p.amount ?? 0)}`,
      time:    relTime(p.created_at),
      rawTime: p.created_at,
      dot:     paid ? "bg-[#6ee7b7]" : "bg-[var(--color-secondary)]",
      dotBg:   paid ? "bg-[#6ee7b7]/20" : "bg-[var(--color-secondary)]/20",
      pulse:   !paid,
    })
  }

  // Sort merged feed newest first
  feedItems.sort((a, b) => new Date(b.rawTime).getTime() - new Date(a.rawTime).getTime())
  const feed = feedItems.slice(0, 7)

  // ── Fleet Stats ───────────────────────────────────────────────────────────

  const allStatuses  = (allDeliveryStatusesRes.data ?? []).map(d => d.status)
  const totalOrders  = allStatuses.length
  const deliveredN   = allStatuses.filter(s => s === "delivered").length
  const cancelledN   = allStatuses.filter(s => s === "cancelled").length
  const activeN      = allStatuses.filter(s => ["accepted", "collected", "in_transit"].includes(s)).length

  const allDriverProfiles = driverProfilesRes.data ?? []
  const approvedN    = allDriverProfiles.filter(d => d.status === "approved").length
  const totalDriverN = allDriverProfiles.length

  const completionRate = deliveredN + cancelledN > 0
    ? Math.round((deliveredN / (deliveredN + cancelledN)) * 100)
    : 0
  const activeJobRate  = totalOrders > 0 ? Math.round((activeN / totalOrders) * 100) : 0
  const approvalRate   = totalDriverN > 0 ? Math.round((approvedN / totalDriverN) * 100) : 0

  const fleetBars = [
    { label: "Delivery Completion", pct: completionRate, color: "bg-[var(--color-primary)]",  subtext: `${deliveredN} delivered` },
    { label: "Jobs Currently Active", pct: activeJobRate,  color: "bg-[var(--color-secondary)]", subtext: `${activeN} in progress` },
    { label: "Driver Approval Rate",  pct: approvalRate,   color: "bg-[var(--color-tertiary)]", subtext: `${approvedN} approved` },
  ]

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[#131313]">

      {/* Page Header */}
      <div className="mb-6 md:mb-8">
        <h2 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          Overview <span className="text-[var(--color-primary)]">&amp;</span> Analytics
        </h2>
        <p className="text-[#adaaaa] mt-2 text-sm">Real-time throughput and platform performance metrics.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[#1a1919]/60 backdrop-blur-xl border border-[#494847]/15 p-6 rounded-xl relative overflow-hidden group"
          >
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-[#adaaaa] text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                <h3 className="font-headline text-2xl md:text-4xl font-bold text-[var(--color-primary)]">{stat.value}</h3>
                <p className={`text-xs mt-2 flex items-center font-bold ${stat.deltaUp ? "text-[var(--color-secondary)]" : "text-[#ff6e84]"}`}>
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
            <div className="absolute bottom-0 left-0 w-full h-16 opacity-20 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 400 60" preserveAspectRatio="none">
                <path d="M0 50 Q 50 10, 100 35 T 200 20 T 300 40 T 400 15 V 60 H 0 Z" fill="var(--color-primary)" fillOpacity="0.4" />
              </svg>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Left column ── */}
        <div className="col-span-1 lg:col-span-8 space-y-6">

          {/* Revenue Velocity — real 7-day bars */}
          <div className="bg-[#1a1919] rounded-xl p-5 md:p-8 relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-xl font-bold font-headline text-white">Revenue Velocity</h4>
                <p className="text-[#adaaaa] text-sm">Last 7 days — gross fare collected per day</p>
              </div>
              <div className="text-xs text-[#adaaaa] bg-[#262626] px-3 py-1.5 rounded-lg">
                {fmt(days7.reduce((s, d) => s + d.revenue, 0))} total
              </div>
            </div>
            <div className="h-48 flex items-end justify-between gap-2 relative">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="w-full h-px bg-white" />
                ))}
              </div>
              {chartBars.map((bar, i) => (
                <div
                  key={i}
                  className={`w-full rounded-t-lg relative group transition-all hover:brightness-125 ${
                    bar.isToday
                      ? "bg-[var(--color-secondary)]/40 shadow-[0px_0px_15px_rgba(var(--brand-rgb),0.2)]"
                      : "bg-[var(--color-primary)]/20"
                  }`}
                  style={{ height: `${bar.heightPct}%` }}
                >
                  <div className={`absolute inset-x-0 bottom-0 h-full bg-gradient-to-t ${bar.isToday ? "from-[var(--color-secondary)]/60" : "from-[var(--color-primary)]/40"} to-transparent`} />
                  {/* Tooltip on hover */}
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-[#262626]/95 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity text-white whitespace-nowrap pointer-events-none z-10">
                    {bar.revenue > 0 ? fmt(bar.revenue) : "No data"}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between text-[10px] font-bold text-[#adaaaa] uppercase tracking-widest px-1">
              {chartBars.map((bar, i) => (
                <span key={i} className={bar.isToday ? "text-[var(--color-secondary)]" : ""}>{bar.label}</span>
              ))}
            </div>
          </div>

          {/* Pending Driver Approvals */}
          <div className="bg-[#1a1919] rounded-xl overflow-hidden">
            <div className="p-6 flex justify-between items-center">
              <h4 className="font-headline text-lg font-bold text-white">Pending Driver Approvals</h4>
              <a href="/dashboard/admin/drivers" className="text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest hover:underline transition-all">
                View All
              </a>
            </div>
            {/* Mobile list */}
            <div className="md:hidden divide-y divide-[#494847]/10">
              {(pendingDriversRes.data ?? []).length === 0 ? (
                <p className="py-10 text-center text-[#adaaaa] text-sm">No pending applications</p>
              ) : (
                (pendingDriversRes.data ?? []).map((driver: any) => {
                  const user = Array.isArray(driver.users) ? driver.users[0] : driver.users
                  const name = user?.full_name ?? "Unknown"
                  const phone = user?.phone ?? null
                  const vehicles = (driver.driver_vehicles ?? []) as { vehicle_type: string }[]
                  const vehicleSummary = vehicles.length > 0
                    ? vehicles.map((v) => isVehicleType(v.vehicle_type) ? VEHICLE_INFO[v.vehicle_type].label : v.vehicle_type).join(", ")
                    : "No vehicle registered"
                  return (
                    <a key={driver.id} href={`/dashboard/admin/drivers/${driver.id}`} className="flex items-center gap-3 px-4 py-4 hover:bg-[#262626] transition-colors">
                      <div className="w-9 h-9 rounded-full bg-[#262626] flex items-center justify-center font-bold text-xs text-white shrink-0">
                        {name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{name}</p>
                        <p className="text-xs text-[#adaaaa]">
                          {vehicleSummary}{phone ? ` · ${phone}` : ""}
                        </p>
                        <p className="text-xs text-[#494847]">{new Date(driver.created_at).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]">Pending</span>
                      <span className="material-symbols-outlined text-[var(--color-primary)] text-lg shrink-0">chevron_right</span>
                    </a>
                  )
                })
              )}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#201f1f]/50 text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold">
                  <tr>
                    <th className="px-6 py-4">Driver</th>
                    <th className="px-6 py-4">Phone</th>
                    <th className="px-6 py-4">Vehicles</th>
                    <th className="px-6 py-4">Applied</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#494847]/10">
                  {(pendingDriversRes.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-[#adaaaa] text-sm">
                        No pending applications
                      </td>
                    </tr>
                  ) : (
                    (pendingDriversRes.data ?? []).map((driver: any) => {
                      const user = Array.isArray(driver.users) ? driver.users[0] : driver.users
                      const name = user?.full_name ?? "Unknown"
                      const phone = user?.phone ?? "—"
                      const vehicles = (driver.driver_vehicles ?? []) as { vehicle_type: string }[]
                      return (
                        <tr key={driver.id} className="hover:bg-[#201f1f] transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#262626] flex items-center justify-center font-bold text-xs text-white shrink-0">
                                {name.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-white">{name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-[#adaaaa]">{phone}</td>
                          <td className="px-6 py-4 text-sm text-[#adaaaa]">
                            {vehicles.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {vehicles.map((v, i) => (
                                  <span key={i} className="px-2 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-bold uppercase">
                                    {isVehicleType(v.vehicle_type) ? VEHICLE_INFO[v.vehicle_type].label : v.vehicle_type}
                                  </span>
                                ))}
                              </div>
                            ) : <span className="text-[#494847]">—</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-[#adaaaa] whitespace-nowrap">
                            {new Date(driver.created_at).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-secondary)] animate-pulse" />
                              Pending
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <a
                              href={`/dashboard/admin/drivers/${driver.id}`}
                              className="p-2 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors inline-flex"
                              title="Review driver"
                            >
                              <span className="material-symbols-outlined text-lg">arrow_forward</span>
                            </a>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-[#1a1919] rounded-xl overflow-hidden">
            <div className="p-6 flex justify-between items-center">
              <h4 className="font-headline text-lg font-bold text-white">Recent Orders</h4>
              <a href="/dashboard/admin/orders" className="text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest hover:underline transition-all">
                View All
              </a>
            </div>
            {/* Mobile list */}
            <div className="md:hidden divide-y divide-[#494847]/10">
              {recentOrders.length === 0 ? (
                <p className="py-10 text-center text-[#adaaaa] text-sm">No orders yet</p>
              ) : (
                recentOrders.map((order) => {
                  const customerName = order.customer_id ? (userNameMap[order.customer_id] ?? "Unknown Customer") : "—"
                  const driverName   = order.driver_id   ? (userNameMap[order.driver_id]   ?? "Unassigned")       : "Unassigned"
                  return (
                    <div key={order.id} className="px-4 py-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-mono text-[var(--color-primary)] truncate">{order.tracking_number ?? "—"}</p>
                        <StatusPill status={order.status} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-[#adaaaa] truncate">
                          <span className="text-white font-semibold">{customerName}</span>
                          {order.item_description ? ` · ${order.item_description}` : ""}
                        </p>
                        <p className="text-sm font-bold text-white shrink-0">{order.price != null ? fmt(order.price) : "—"}</p>
                      </div>
                      {(order.pickup_address || order.delivery_address) && (
                        <div className="text-xs text-[#494847] space-y-0.5">
                          {order.pickup_address && (
                            <p className="truncate"><span className="text-[#adaaaa]/60">From:</span> {order.pickup_address}</p>
                          )}
                          {order.delivery_address && (
                            <p className="truncate"><span className="text-[#adaaaa]/60">To:</span> {order.delivery_address}</p>
                          )}
                        </div>
                      )}
                      <p className="text-[10px] text-[#494847]">
                        {new Date(order.created_at).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                        {order.driver_id ? ` · Driver: ${driverName}` : " · Unassigned"}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#201f1f]/50 text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold">
                  <tr>
                    <th className="px-5 py-4">Tracking #</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Item</th>
                    <th className="px-5 py-4">Route</th>
                    <th className="px-5 py-4">Driver</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Price</th>
                    <th className="px-5 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#494847]/10">
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-[#adaaaa] text-sm">No orders yet</td>
                    </tr>
                  ) : (
                    recentOrders.map((order) => {
                      const customerName = order.customer_id ? (userNameMap[order.customer_id] ?? "Unknown") : "—"
                      const driverName   = order.driver_id   ? (userNameMap[order.driver_id]   ?? "—")       : "—"
                      const pickup   = order.pickup_address   ?? "—"
                      const delivery = order.delivery_address ?? "—"
                      return (
                        <tr key={order.id} className="hover:bg-[#201f1f] transition-colors">
                          <td className="px-5 py-4 font-mono text-sm text-[var(--color-primary)] whitespace-nowrap">{order.tracking_number ?? "—"}</td>
                          <td className="px-5 py-4 text-sm text-white font-medium whitespace-nowrap">{customerName}</td>
                          <td className="px-5 py-4 text-sm text-[#adaaaa] max-w-[120px]">
                            <span className="truncate block" title={order.item_description ?? ""}>{order.item_description ?? <span className="text-[#494847]">—</span>}</span>
                          </td>
                          <td className="px-5 py-4 max-w-[180px]">
                            <div className="space-y-0.5">
                              <p className="text-xs text-[#adaaaa] truncate" title={pickup}>
                                <span className="text-[#6ee7b7] font-bold text-[10px]">FROM </span>{pickup}
                              </p>
                              <p className="text-xs text-[#adaaaa] truncate" title={delivery}>
                                <span className="text-[var(--color-primary)] font-bold text-[10px]">TO </span>{delivery}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-[#adaaaa] whitespace-nowrap">
                            {order.driver_id ? driverName : <span className="text-[#494847] text-xs">Unassigned</span>}
                          </td>
                          <td className="px-5 py-4">
                            <StatusPill status={order.status} />
                          </td>
                          <td className="px-5 py-4 text-sm font-bold text-white whitespace-nowrap">
                            {order.price != null ? fmt(order.price) : <span className="text-[#494847]">—</span>}
                          </td>
                          <td className="px-5 py-4 text-sm text-[#adaaaa] whitespace-nowrap">
                            {new Date(order.created_at).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Right column: Activity Feed + Fleet Stats ── */}
        <div className="col-span-1 lg:col-span-4">
          <div className="bg-[#1a1919]/60 backdrop-blur-xl border border-[#494847]/15 rounded-xl h-full flex flex-col">
            <div className="p-6 border-b border-[#494847]/10">
              <h4 className="font-headline text-lg font-bold text-white">Activity Feed</h4>
              <p className="text-[#adaaaa] text-[11px] uppercase tracking-widest mt-1">Live Platform Events</p>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {feed.length === 0 ? (
                <div className="py-10 text-center">
                  <span className="material-symbols-outlined text-[#494847] text-3xl mb-3 block">notifications_none</span>
                  <p className="text-sm font-bold text-white mb-1">No activity yet</p>
                  <p className="text-xs text-[#adaaaa]">Platform events will appear here as deliveries are processed.</p>
                </div>
              ) : (
                feed.map((item, i) => (
                  <div key={item.id} className="flex gap-4 relative">
                    {i < feed.length - 1 && (
                      <div className="absolute left-[11px] top-6 bottom-[-24px] w-[1px] border-l border-dashed border-[#494847]" />
                    )}
                    <div className={`w-6 h-6 rounded-full ${item.dotBg} flex items-center justify-center relative z-10 shrink-0 mt-0.5`}>
                      {item.dot ? (
                        <div className={`w-2 h-2 ${item.dot} rounded-full ${item.pulse ? "animate-pulse shadow-[0_0_8px_rgba(var(--brand-rgb),0.8)]" : ""}`} />
                      ) : (
                        <span className="material-symbols-outlined text-[14px] text-[#adaaaa]">{item.icon}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white leading-tight">{item.title}</p>
                      <p className="text-xs text-[#adaaaa] mt-0.5 leading-relaxed">{item.body}</p>
                      <span className="text-[10px] text-[#adaaaa]/60 font-bold mt-1 inline-block uppercase">{item.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Fleet Stats — real data */}
            <div className="p-6 border-t border-[#494847]/10">
              <h5 className="text-xs font-bold font-headline text-white mb-4 uppercase tracking-widest">Fleet Stats</h5>
              <div className="space-y-4">
                {fleetBars.map((bar) => (
                  <div key={bar.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-white">{bar.label}</span>
                      <span className="text-[#adaaaa]">{bar.pct}% <span className="text-[#494847]">· {bar.subtext}</span></span>
                    </div>
                    <div className="h-1 w-full bg-[#262626] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${bar.color} rounded-full transition-all`}
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
    delivered:  { label: "Delivered",  className: "bg-[#6ee7b7]/10 text-[#6ee7b7]"  },
    requested:  { label: "Requested",  className: "bg-[#adaaaa]/10 text-[#adaaaa]"  },
    accepted:   { label: "Accepted",   className: "bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]"  },
    collected:  { label: "Collected",  className: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"  },
    in_transit: { label: "In Transit", className: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"  },
    cancelled:  { label: "Cancelled",  className: "bg-[#ff6e84]/10 text-[#ff6e84]"  },
  }
  const cfg = map[status] ?? { label: status, className: "bg-[#262626] text-[#adaaaa]" }
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

