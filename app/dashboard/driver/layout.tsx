import { DriverActiveTracking } from "@/components/tracking/driver-active-tracking"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { DriverLayoutClient } from "./layout-client"

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const profile = { full_name: "", email: authUser?.email ?? "" }
  let isOnline = false
  let driverStatus = "pending"
  let hasDocuments = false
  let hasActiveJobs=false
  let submittedAt: string|null=null

  if (authUser) {
    const admin = createAdminClient()
    const [usersRes, profileRes, docsRes,activeRes] = await Promise.all([
      supabase.from("users").select("full_name").eq("id", authUser.id).single(),
      admin.from("driver_profiles").select("is_online, status,verification_submitted_at").eq("id", authUser.id).single(),
      admin.from("driver_documents").select("id", { count: "exact", head: true }).eq("driver_id", authUser.id),
      admin.from("delivery_requests").select("id",{count:"exact",head:true}).eq("driver_id",authUser.id).in("status",["accepted","collected","picked_up","in_transit"]),
    ])
    profile.full_name = usersRes.data?.full_name ?? ""
    isOnline = profileRes.data?.is_online ?? false
    driverStatus = profileRes.data?.status ?? "pending"
    submittedAt=profileRes.data?.verification_submitted_at??null
    hasDocuments = (docsRes.count ?? 0) > 0
    hasActiveJobs=(activeRes.count??0)>0
  }

  return (
    <DriverLayoutClient hasActiveJobs={hasActiveJobs} user={profile} isOnline={isOnline} driverStatus={driverStatus} hasDocuments={hasDocuments} submittedAt={submittedAt} userId={authUser?.id ?? ""}>
      {driverStatus === "approved" && authUser && <DriverActiveTracking userId={authUser.id} />}
      {children}
    </DriverLayoutClient>
  )
}
