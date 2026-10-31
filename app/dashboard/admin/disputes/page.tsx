import { createAdminClient } from "@/lib/supabase/admin"
import { DisputesPanel } from "@/components/admin/disputes-panel"

export default async function AdminDisputesPage() {
  const admin = createAdminClient()

  const { data: disputes, count, error } = await admin
    .from("disputes")
    .select("id, status, issue, created_at, raised_by, delivery_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) throw new Error("Disputes could not load. Please retry.")
  return <DisputesPanel disputes={disputes ?? []} total={count ?? 0} />
}
