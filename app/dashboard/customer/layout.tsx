import { getDashboardUser } from "@/lib/dashboard-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { boundedFetch } from "@/lib/short-request"
import CustomerDashboardLayoutClient from "./layout-client"

export default async function Layout({children}:{children:React.ReactNode}) {
  const user=await getDashboardUser()
  const {data}=user ? await createAdminClient(boundedFetch(2200)).from("users").select("full_name").eq("id",user.id).maybeSingle() : {data:null}
  const name=data?.full_name || (typeof user?.user_metadata?.full_name==="string" ? user.user_metadata.full_name : "")
  return <CustomerDashboardLayoutClient key={user?.id??""} profile={{id:user?.id??"",name,email:user?.email??""}}>{children}</CustomerDashboardLayoutClient>
}
