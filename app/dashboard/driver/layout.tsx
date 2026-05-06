import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { DriverLayoutClient } from "./layout-client"

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  let profile = { full_name: "", email: authUser?.email ?? "" }
  let isOnline = false

  if (authUser) {
    const admin = createAdminClient()
    const [usersRes, profileRes] = await Promise.all([
      supabase.from("users").select("full_name").eq("id", authUser.id).single(),
      admin.from("driver_profiles").select("is_online").eq("id", authUser.id).single(),
    ])
    profile.full_name = usersRes.data?.full_name ?? ""
    isOnline = profileRes.data?.is_online ?? false
  }

  return <DriverLayoutClient user={profile} isOnline={isOnline}>{children}</DriverLayoutClient>
}
