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

  // ── Parallel data fetch ────────────────────────────────────────────────────
  const [paymentsRes, payoutsRes, earningsRes] = await Promise.all([
    admin
      .from("payments")
      .select("id, amount, status, created_at, delivery_id")
      .order("created_at", { ascending: false }),

    admin
      .from("payouts")
      .select("id, amount, status, created_at, driver_id")
      .order("created_at", { ascending: false }),

    admin
      .from("driver_earnings")
      .select("amount, commission_amount"),
  ])

  const payments = paymentsRes.data ?? []
  const payouts  = payoutsRes.data  ?? []
  const earnings = earningsRes.data ?? []

  // ── Enrich payments with customer info ────────────────────────────────────
  // payments.delivery_id → delivery_requests.customer_id → users
  const deliveryIds = [...new Set(
    payments.map(p => p.delivery_id).filter((id): id is string => !!id),
  )]

  const deliveriesRes = deliveryIds.length > 0
    ? await admin
        .from("delivery_requests")
        .select("id, tracking_number, customer_id")
        .in("id", deliveryIds)
    : { data: [] as { id: string; tracking_number: string | null; customer_id: string | null }[] }

  const deliveries    = deliveriesRes.data ?? []

  // Build delivery lookup map
  const deliveryMap: Record<string, { tracking_number: string | null; customer_id: string | null }> = {}
  for (const d of deliveries) {
    deliveryMap[d.id] = { tracking_number: d.tracking_number, customer_id: d.customer_id }
  }

  // Collect all user IDs needed (customers + drivers) in one query
  const customerIds = deliveries.map(d => d.customer_id).filter((id): id is string => !!id)
  const driverIds   = payouts.map(p => p.driver_id).filter((id): id is string => !!id)
  const allUserIds  = [...new Set([...customerIds, ...driverIds])]

  const usersRes = allUserIds.length > 0
    ? await admin
        .from("users")
        .select("id, full_name, email")
        .in("id", allUserIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] }

  // Build user lookup map
  const usersMap: Record<string, { full_name: string | null; email: string | null }> = {}
  for (const u of (usersRes.data ?? [])) {
    usersMap[u.id] = { full_name: u.full_name, email: u.email }
  }

  // ── Assemble enriched rows ─────────────────────────────────────────────────
  const enrichedPayments = payments.map(p => {
    const delivery = p.delivery_id ? deliveryMap[p.delivery_id] : null
    const customer = delivery?.customer_id ? usersMap[delivery.customer_id] : null
    return {
      ...p,
      tracking_number: delivery?.tracking_number ?? null,
      customer_name:   customer?.full_name        ?? null,
      customer_email:  customer?.email            ?? null,
    }
  })

  const enrichedPayouts = payouts.map(p => {
    const driver = p.driver_id ? usersMap[p.driver_id] : null
    return {
      ...p,
      driver_name:  driver?.full_name ?? null,
      driver_email: driver?.email     ?? null,
    }
  })

  return (
    <PaymentsPanel
      payments={enrichedPayments}
      payouts={enrichedPayouts}
      earnings={earnings}
    />
  )
}
