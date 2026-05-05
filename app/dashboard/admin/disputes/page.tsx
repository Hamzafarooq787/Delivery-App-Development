import { createClient } from "@/lib/supabase/server"
import { DisputesPanel } from "@/components/admin/disputes-panel"

export default async function AdminDisputesPage() {
  const supabase = await createClient()

  const { data: disputes, count } = await supabase
    .from("disputes")
    .select("id, status, category, description, created_at, user_id, delivery_request_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(50)

  return <DisputesPanel disputes={disputes ?? []} total={count ?? 0} />
}
