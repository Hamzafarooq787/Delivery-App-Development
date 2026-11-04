import { DriverActiveTracking } from "@/components/tracking/driver-active-tracking"
import { getDashboardUser } from "@/lib/dashboard-user"
import { getDriverActiveJobs, getDriverReadProfile } from "@/lib/driver-read-context"
import { boundedFetch } from "@/lib/short-request"
import { createAdminClient } from "@/lib/supabase/admin"
import { DriverLayoutClient } from "./layout-client"

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getDashboardUser()

  const profile = { full_name: "", email: authUser?.email ?? "" }
  let isOnline = false
  let driverStatus = "pending"
  let hasActiveJobs=false
  let submittedAt: string|null=null

  if (authUser) {
    const admin = createAdminClient(boundedFetch(3500))
    const [usersRes, profileRes,activeRes] = await Promise.all([
      admin.from("users").select("full_name").eq("id", authUser.id).single(),
      getDriverReadProfile(authUser.id),
      getDriverActiveJobs(authUser.id),
    ])
    profile.full_name = usersRes.data?.full_name ?? ""
    isOnline = profileRes.data?.is_online ?? false
    driverStatus = profileRes.data?.status ?? "pending"
    submittedAt=profileRes.data?.verification_submitted_at??null
    hasActiveJobs=(activeRes.data?.length??0)>0
  }

  return (
    <DriverLayoutClient hasActiveJobs={hasActiveJobs} user={profile} isOnline={isOnline} driverStatus={driverStatus} hasDocuments={!!submittedAt} submittedAt={submittedAt} userId={authUser?.id ?? ""}>
      {driverStatus === "approved" && authUser && <DriverActiveTracking userId={authUser.id} />}
      {children}
    </DriverLayoutClient>
  )
}
