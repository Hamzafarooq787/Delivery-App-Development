import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect("/login")
  }
  
  // Fetch the user's role from the database
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  
  const role = profile?.role || "customer"
  
  // Determine the redirect path based on role
  let redirectPath = "/dashboard/customer"
  if (role === "admin") {
    redirectPath = "/dashboard/admin"
  } else if (role === "driver") {
    redirectPath = "/dashboard/driver"
  }
  
  redirect(redirectPath)
}
