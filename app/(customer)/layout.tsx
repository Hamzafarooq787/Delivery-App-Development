import { createClient } from "@/lib/supabase/server"
import { CustomerLayoutClient } from "./layout-client"

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  let profile = { full_name: "", email: authUser?.email ?? "" }
  if (authUser) {
    const { data } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", authUser.id)
      .single()
    profile.full_name = data?.full_name ?? ""
  }

  return <CustomerLayoutClient user={profile}>{children}</CustomerLayoutClient>
}
