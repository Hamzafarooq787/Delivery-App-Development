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

  if (authUser) {
    const admin = createAdminClient()
    const [usersRes, profileRes, docsRes] = await Promise.all([
      supabase.from("users").select("full_name").eq("id", authUser.id).single(),
      admin.from("driver_profiles").select("is_online, status").eq("id", authUser.id).single(),
      admin.from("driver_documents").select("id", { count: "exact", head: true }).eq("driver_id", authUser.id),
    ])
    profile.full_name = usersRes.data?.full_name ?? ""
    isOnline = profileRes.data?.is_online ?? false
    driverStatus = profileRes.data?.status ?? "pending"
    hasDocuments = (docsRes.count ?? 0) > 0
  }

  return (
    <DriverLayoutClient user={profile} isOnline={isOnline} driverStatus={driverStatus} hasDocuments={hasDocuments} userId={authUser?.id ?? ""}>
      {children}
    </DriverLayoutClient>
  )
}
