import { createClient } from "@/lib/supabase/server"
import { EarningsPanel } from "@/components/driver/earnings-panel"
import { SubTabs } from "@/components/ui/sub-tabs"

export const dynamic = "force-dynamic"

export default async function EarningsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [earningsRes, fallbackRes] = await Promise.all([
    // Primary: driver_earnings joined with delivery info
    supabase
      .from("driver_earnings")
      .select("id, amount, commission_amount, status, created_at, delivery_requests(pickup_address, delivery_address, created_at, price, tracking_number)")
      .eq("driver_id", user?.id ?? "")
      .order("created_at", { ascending: false }),

    // Fallback: completed deliveries where driver_earnings row doesn't exist yet
    // (for jobs completed before the auto-earnings feature was added)
    supabase
      .from("delivery_requests")
      .select("id, tracking_number, pickup_address, delivery_address, price, created_at")
      .eq("driver_id", user?.id ?? "")
      .eq("status", "delivered")
      .order("created_at", { ascending: false }),
  ])

  const earnings = earningsRes.data ?? []

  // If no driver_earnings rows exist, synthesise them from completed deliveries
  // so the page is never empty for drivers who completed jobs before the commission system was added
  const earningsDeliveryIds = new Set(
    earnings.map((e: any) => {
      const dr = e.delivery_requests
      return Array.isArray(dr) ? dr[0]?.id : null
    }).filter(Boolean)
  )

  const syntheticEarnings = (fallbackRes.data ?? [])
    .filter(d => !earningsDeliveryIds.has(d.id))
    .map(d => ({
      id: `synthetic-${d.id}`,
      amount: d.price != null ? Math.round(d.price * 0.75 * 100) / 100 : null,
      commission_amount: d.price != null ? Math.round(d.price * 0.25 * 100) / 100 : null,
      status: "paid" as const,  // completed jobs are treated as paid
      created_at: d.created_at,
      delivery_requests: {
        pickup_address: d.pickup_address,
        delivery_address: d.delivery_address,
        created_at: d.created_at,
        price: d.price,
        tracking_number: d.tracking_number,
      },
    }))

  const allEarnings = [...earnings, ...syntheticEarnings]

  return (
    <>
      <SubTabs
        className="mb-6"
        tabs={[
          { label: "Earnings", href: "/dashboard/driver/earnings", icon: "payments" },
          { label: "Payouts",  href: "/dashboard/driver/payouts",  icon: "account_balance_wallet" },
        ]}
      />
      <EarningsPanel earnings={allEarnings as any} />
    </>
  )
}
