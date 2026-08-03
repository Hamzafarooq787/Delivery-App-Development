import { createClient } from "@/lib/supabase/server"
import { getMyDocuments } from "@/app/actions/documents"
import { getMyVehicles } from "@/app/actions/vehicles"
import { VerificationPanel } from "@/components/driver/verification-panel"
import { redirect } from "next/navigation"

export default async function VerificationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const admin = (await import("@/lib/supabase/admin")).createAdminClient()

  const [profileRes, docsRes, vehiclesRes] = await Promise.all([
    admin.from("driver_profiles").select("status").eq("id", user.id).single(),
    getMyDocuments(),
    getMyVehicles(),
  ])

  const driverStatus = (profileRes.data?.status ?? "pending") as "pending" | "approved" | "rejected"

  return (
    <VerificationPanel
      driverStatus={driverStatus}
      documents={docsRes.data}
      vehicles={vehiclesRes.data}
      userId={user.id}
    />
  )
}
