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
  
  // Redirect to the appropriate dashboard based on role
  if (role === "admin") {
    redirect("/dashboard/admin")
  } else if (role === "driver") {
    redirect("/dashboard/driver")
  } else {
    redirect("/dashboard/customer")
  }
}
