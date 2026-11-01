import "server-only"
import type { User } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"

// The caller must supply a user verified by auth.getUser(), never form input.
export async function ensureVerifiedProfile(user: User, requestedRole: "customer" | "driver" = "customer") {
  const db = createAdminClient()
  const existing = await db.from("users").select("role,account_status").eq("id", user.id).maybeSingle()
  if (existing.error) throw new Error("Your account could not be loaded. Please retry.")
  if (!existing.data) {
    const meta = user.user_metadata ?? {}
    const name = typeof meta.full_name === "string" ? meta.full_name.slice(0,160) : user.email?.split("@")[0] ?? "User"
    const inserted = await db.from("users").upsert({id:user.id,role:requestedRole,full_name:name,email:user.email},{onConflict:"id",ignoreDuplicates:true})
    if (inserted.error) throw new Error("Your account could not be created. Please retry.")
  }
  // Re-read after insert-on-conflict so a concurrent callback cannot select a stale role.
  const saved = await db.from("users").select("role,account_status").eq("id",user.id).single()
  if (saved.error || !saved.data || saved.data.account_status !== "active" || !["admin","driver","customer"].includes(saved.data.role)) throw new Error("Your account is unavailable. Please contact support.")
  const role = saved.data.role as "admin" | "customer" | "driver"
  if (role !== "admin") {
    const profile = await db.from(role === "driver" ? "driver_profiles" : "customer_profiles").upsert(role === "driver" ? {id:user.id,status:"pending"} : {id:user.id},{onConflict:"id",ignoreDuplicates:true})
    if (profile.error) throw new Error("Your profile could not be loaded. Please retry.")
  }
  return role
}
