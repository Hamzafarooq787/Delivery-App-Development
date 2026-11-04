import { getDashboardUser } from "@/lib/dashboard-user"
import { boundedFetch } from "@/lib/short-request"
import { createAdminClient } from "@/lib/supabase/admin"
import { getMyDocuments } from "@/app/actions/documents"
import { getMyVehicles } from "@/app/actions/vehicles"
import { VerificationPanel } from "@/components/driver/verification-panel"
import { redirect } from "next/navigation"

export default async function VerificationPage() {
  const user = await getDashboardUser()
  if (!user) redirect("/login")

  const admin = createAdminClient(boundedFetch(3500))

  const [profileRes, docsRes, vehiclesRes] = await Promise.all([
    admin.from("driver_profiles").select("status,verification_submitted_at").eq("id", user.id).single(),
    getMyDocuments(),
    getMyVehicles(),
  ])

  const driverStatus = (profileRes.data?.status ?? "pending") as "pending" | "approved" | "rejected"

  return (
    <VerificationPanel
      driverStatus={driverStatus}
      documents={docsRes.data}
      vehicles={vehiclesRes.data}
      submittedAt={profileRes.data?.verification_submitted_at}
      userId={user.id}
    />
  )
}
