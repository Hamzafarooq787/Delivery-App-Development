import { createAdminClient } from "@/lib/supabase/admin"
import { DisputesPanel } from "@/components/admin/disputes-panel"

export default async function AdminDisputesPage() {
  const admin = createAdminClient()

  const { data: disputes, count } = await admin
    .from("disputes")
    .select("id, status, category, description, created_at, user_id, delivery_request_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(50)

  return <DisputesPanel disputes={disputes ?? []} total={count ?? 0} />
}
