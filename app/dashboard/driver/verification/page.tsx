import { createClient } from "@/lib/supabase/server"
import { getMyDocuments } from "@/app/actions/documents"
import { VerificationPanel } from "@/components/driver/verification-panel"
import { redirect } from "next/navigation"

export default async function VerificationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const admin = (await import("@/lib/supabase/admin")).createAdminClient()

  const [profileRes, docsRes] = await Promise.all([
    admin.from("driver_profiles").select("status").eq("id", user.id).single(),
    getMyDocuments(),
  ])

  const driverStatus = (profileRes.data?.status ?? "pending") as "pending" | "approved" | "rejected"

  return (
    <VerificationPanel
      driverStatus={driverStatus}
      documents={docsRes.data}
      userId={user.id}
    />
  )
}
