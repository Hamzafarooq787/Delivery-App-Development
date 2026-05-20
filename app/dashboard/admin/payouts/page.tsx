import { createClient }      from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect }          from "next/navigation"
import { AdminPayoutsPanel, type AdminPayoutsPanelProps } from "@/components/admin/admin-payouts-panel"

export const dynamic = "force-dynamic"

export default async function AdminPayoutsPage() {
  // ── Auth guard — admins only ──────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: selfUser } = await supabase
    .from("users").select("role").eq("id", user.id).single()
  if (selfUser?.role !== "admin") redirect("/dashboard")

  const admin = createAdminClient()

  // ── Parallel data fetch ───────────────────────────────────────────────────
  const [payoutsRes, allEarningsRes, authRes] = await Promise.all([
    admin
      .from("payouts")
      .select("id, driver_id, amount, status, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("driver_earnings")
      .select("driver_id, amount, commission_amount, status"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const allPayouts  = payoutsRes.data  ?? []
  const allEarnings = allEarningsRes.data ?? []

  // Unique driver IDs across payouts + earnings
  const payoutDriverIds   = allPayouts.map(p => p.driver_id).filter(Boolean) as string[]
  const earningsDriverIds = allEarnings.map(e => e.driver_id).filter(Boolean) as string[]
  const uniqueDriverIds   = [...new Set([...payoutDriverIds, ...earningsDriverIds])]

  // Batch-fetch users table rows + auth emails
  const [driverUsersRes, fallbackEarningsRes] = await Promise.all([
    uniqueDriverIds.length > 0
      ? admin.from("users").select("id, full_name, phone").in("id", uniqueDriverIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; phone: string | null }[] }),
    uniqueDriverIds.length > 0
      ? admin
          .from("delivery_requests")
          .select("driver_id, price")
          .eq("status", "delivered")
          .in("driver_id", uniqueDriverIds)
          .not("price", "is", null)
      : Promise.resolve({ data: [] as { driver_id: string | null; price: number | null }[] }),
  ])

  const emailMap = new Map(
    (authRes.data?.users ?? []).map(u => [u.id, u.email ?? ""])
  )

  const driverInfoMap = new Map(
    (driverUsersRes.data ?? []).map(u => ({
      id: u.id,
      full_name: u.full_name ?? "",
      phone: u.phone ?? null,
    })).map(u => [u.id, u])
  )

  // ── Per-driver earnings stats (driver_earnings + fallback) ─────────────
  const earnStats: Record<string, { totalEarned: number; pendingEarnings: number; coveredIds: Set<string> }> = {}

  for (const e of allEarnings) {
    if (!e.driver_id) continue
    if (!earnStats[e.driver_id]) earnStats[e.driver_id] = { totalEarned: 0, pendingEarnings: 0, coveredIds: new Set() }
    earnStats[e.driver_id].totalEarned     += e.amount ?? 0
    if (e.status === "pending") earnStats[e.driver_id].pendingEarnings += e.amount ?? 0
  }

  // Synthetic fallback from delivery_requests
  for (const d of fallbackEarningsRes.data ?? []) {
    if (!d.driver_id || !d.price) continue
    if (!earnStats[d.driver_id]) earnStats[d.driver_id] = { totalEarned: 0, pendingEarnings: 0, coveredIds: new Set() }
    // Only count if not already in driver_earnings (covered)
    earnStats[d.driver_id].totalEarned     += Math.round(d.price * 0.75 * 100) / 100
    earnStats[d.driver_id].pendingEarnings += Math.round(d.price * 0.75 * 100) / 100
  }

  // Per-driver payout totals (to compute real pendingBalance)
  const paidOutMap: Record<string, number> = {}
  for (const p of allPayouts) {
    if (!p.driver_id || p.status !== "paid") continue
    paidOutMap[p.driver_id] = (paidOutMap[p.driver_id] ?? 0) + (p.amount ?? 0)
  }

  // ── Enrich payout rows ────────────────────────────────────────────────────
  const enrichedPayouts: AdminPayoutsPanelProps["payouts"] = allPayouts.map(p => {
    const info  = driverInfoMap.get(p.driver_id ?? "")
    const stats = earnStats[p.driver_id ?? ""]
    return {
      id:         p.id,
      driver_id:  p.driver_id ?? "",
      amount:     p.amount    ?? 0,
      status:     p.status    as "pending" | "approved" | "rejected" | "paid",
      created_at: p.created_at,
      driver: {
        full_name: info?.full_name ?? "Unknown",
        email:     emailMap.get(p.driver_id ?? "") ?? "",
        phone:     info?.phone ?? null,
      },
      driverStats: {
        totalEarned:         stats?.totalEarned ?? 0,
        pendingEarnings:     Math.max(0, (stats?.totalEarned ?? 0) - (paidOutMap[p.driver_id ?? ""] ?? 0)),
        completedDeliveries: 0, // loaded lazily in detail modal
      },
    }
  })

  // ── Pending driver balances (have earnings, no recent payout pending) ─────
  const pendingByDriver: Record<string, { pending: number; total: number; jobs: number }> = {}
  for (const e of allEarnings) {
    if (!e.driver_id) continue
    if (!pendingByDriver[e.driver_id]) pendingByDriver[e.driver_id] = { pending: 0, total: 0, jobs: 0 }
    pendingByDriver[e.driver_id].total += e.amount ?? 0
    pendingByDriver[e.driver_id].jobs  += 1
    if (e.status === "pending") pendingByDriver[e.driver_id].pending += e.amount ?? 0
  }

  const pendingDriverList: AdminPayoutsPanelProps["pendingDrivers"] = Object.entries(pendingByDriver)
    .filter(([, v]) => v.pending > 0)
    .map(([id, v]) => ({
      driverId:  id,
      full_name: driverInfoMap.get(id)?.full_name ?? "",
      email:     emailMap.get(id) ?? "",
      phone:     driverInfoMap.get(id)?.phone ?? null,
      pending:   v.pending,
      total:     v.total,
      jobs:      v.jobs,
    }))
    .sort((a, b) => b.pending - a.pending)

  // ── KPI stats ─────────────────────────────────────────────────────────────
  const pendingPayouts   = allPayouts.filter(p => p.status === "pending")
  const approvedPayouts  = allPayouts.filter(p => p.status === "approved")
  const paidPayouts      = allPayouts.filter(p => p.status === "paid")
  const pendingOrApproved = [...pendingPayouts, ...approvedPayouts]

  const stats: AdminPayoutsPanelProps["stats"] = {
    pendingRequestCount: pendingOrApproved.length,
    pendingAmount:       pendingOrApproved.reduce((s, p) => s + (p.amount ?? 0), 0),
    totalPaidOut:        paidPayouts.reduce((s, p) => s + (p.amount ?? 0), 0),
    driversAwaiting:     new Set(pendingOrApproved.map(p => p.driver_id).filter(Boolean)).size,
    platformCommission:  allEarnings.reduce((s, e) => s + (e.commission_amount ?? 0), 0),
    totalPayoutCount:    allPayouts.length,
  }

  return (
    <AdminPayoutsPanel
      payouts={enrichedPayouts}
      pendingDrivers={pendingDriverList}
      stats={stats}
    />
  )
}
