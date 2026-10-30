import {CardPaymentsOverview} from "@/components/admin/card-payments-overview"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient }      from "@/lib/supabase/server"
import { redirect }          from "next/navigation"
import { PaymentsPanel }     from "@/components/admin/payments-panel"

export const dynamic = "force-dynamic"

export default async function AdminPaymentsPage() {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") redirect("/dashboard")

  // ── Parallel fetch — mirrors Admin Overview query pattern exactly ──────────
  const [earningsRes, deliveredPricesRes, deliveriesRes, payoutsRes] = await Promise.all([
    // 1. driver_earnings → commission / payout KPI totals (same as Overview)
    admin
      .from("driver_earnings")
      .select("amount, commission_amount"),

    // 2. Fallback gross revenue (same as Overview)
    admin
      .from("delivery_requests")
      .select("price")
      .eq("status", "delivered")
      .not("price", "is", null),

    // 3. delivery_requests = customer payment transactions (ALL records with a price)
    //    These are the actual financial events — the payments table is a thin
    //    supplementary record that only exists for recent orders.
    admin
      .from("delivery_requests")
      .select("id, tracking_number, price, status, created_at, customer_id")
      .not("price", "is", null)
      .order("created_at", { ascending: false }),

    // 4. payouts = driver payout transactions
    admin
      .from("payouts")
      .select("id, amount, status, created_at, driver_id")
      .order("created_at", { ascending: false }),
  ])

  const deliveries = deliveriesRes.data ?? []
  const payouts    = payoutsRes.data    ?? []
  const earnings   = earningsRes.data   ?? []

  // ── Resolve user names in one batched query ────────────────────────────────
  const customerIds = [...new Set(
    deliveries.map(d => d.customer_id).filter((id): id is string => !!id),
  )]
  const driverIds = [...new Set(
    payouts.map(p => p.driver_id).filter((id): id is string => !!id),
  )]
  const allUserIds = [...new Set([...customerIds, ...driverIds])]

  const usersRes = allUserIds.length > 0
    ? await admin
        .from("users")
        .select("id, full_name, email")
        .in("id", allUserIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] }

  const usersMap: Record<string, { full_name: string | null; email: string | null }> = {}
  for (const u of (usersRes.data ?? [])) {
    usersMap[u.id] = { full_name: u.full_name, email: u.email }
  }

  // ── Enrich rows ────────────────────────────────────────────────────────────
  const enrichedDeliveries = deliveries.map(d => {
    const c = d.customer_id ? usersMap[d.customer_id] : null
    return {
      ...d,
      customer_name:  c?.full_name ?? null,
      customer_email: c?.email     ?? null,
    }
  })

  const enrichedPayouts = payouts.map(p => {
    const dr = p.driver_id ? usersMap[p.driver_id] : null
    return {
      ...p,
      driver_name:  dr?.full_name ?? null,
      driver_email: dr?.email     ?? null,
    }
  })

  return (
    <>
    <CardPaymentsOverview />
    <PaymentsPanel
      deliveries={enrichedDeliveries}
      payouts={enrichedPayouts}
      earnings={earnings}
      deliveredPrices={deliveredPricesRes.data ?? []}
    />
    </>
  )
}
