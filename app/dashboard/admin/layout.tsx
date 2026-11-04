import { boundedFetch, shortRequest } from "@/lib/short-request"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { adminGetPendingVerificationCount } from "@/app/actions/delivery"
import { adminGetPendingReviewCount } from "@/app/actions/ratings"
import { AdminLayoutClient } from "./layout-client"

export const metadata: Metadata = { title: "GoDrop Admin" }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient(boundedFetch(2800))
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect("/login")

  const { data: roleRow } = await supabase.from("users").select("role,full_name").eq("id", authUser.id).maybeSingle()
  if (roleRow?.role !== "admin") redirect("/login")
  const profile = { full_name: roleRow.full_name ?? "", email: authUser.email ?? "" }

  const [pendingVerifications, pendingReviews] = await Promise.all([
    shortRequest(adminGetPendingVerificationCount(),2400).catch(()=>0),
    shortRequest(adminGetPendingReviewCount(),2400).catch(()=>0),
  ])

  return (
    <AdminLayoutClient user={profile} pendingVerifications={pendingVerifications} pendingReviews={pendingReviews} userId={authUser?.id ?? ""}>
      {children}
    </AdminLayoutClient>
  )
}
