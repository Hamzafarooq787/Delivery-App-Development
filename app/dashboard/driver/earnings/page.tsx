import { createClient } from "@/lib/supabase/server"
import { EarningsPanel } from "@/components/driver/earnings-panel"

export default async function EarningsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: earnings } = await supabase
    .from("driver_earnings")
    .select("id, amount, commission_amount, created_at, delivery_requests(pickup_address, delivery_address, created_at, price)")
    .eq("driver_id", user?.id ?? "")
    .order("created_at", { ascending: false })

  return <EarningsPanel earnings={(earnings ?? []) as any} />
}
