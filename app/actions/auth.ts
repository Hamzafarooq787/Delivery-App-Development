"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAppOrigin } from "@/lib/get-app-origin"
import { ensureVerifiedProfile } from "@/lib/auth-profile"
import { redirect } from "next/navigation"

/**
 * Switch the user's active role and redirect to the matching dashboard.
 * The other profile's data is fully preserved.
 */
export async function switchActiveRole(newRole: "customer" | "driver") {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Server actions are callable directly with arbitrary arguments, bypassing
  // the TypeScript param type — never trust it without a runtime check.
  // Only customer/driver may ever be set here; admin is never reachable
  // through this path.
  if (newRole !== "customer" && newRole !== "driver") redirect("/login")

  const admin = createAdminClient()
  const { error } = await admin.rpc("switch_account_mode", { p_user: user.id, p_role: newRole })
  if (error) return { error: error.message.includes("active_delivery")
    ? "Finish your active delivery before switching to customer mode."
    : "Could not switch mode. Check that this profile is available and try again." }

  redirect(newRole === "driver" ? "/dashboard/driver" : "/dashboard/customer")
}

/**
 * Add a secondary role profile without changing the active role.
 * Creates driver_profiles (status=pending) or customer_profiles row.
 */
export async function addSecondaryRole(newRole: "customer" | "driver") {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  if (!["customer", "driver"].includes(newRole)) return { error: "Invalid role" }
  const admin = createAdminClient()
  const account = await admin.from("users").select("role,account_status").eq("id", user.id).single()
  if (account.error || account.data?.account_status !== "active" || account.data.role === "admin") return { error: "Account unavailable" }

  if (newRole === "driver") {
    const { error } = await admin
      .from("driver_profiles")
      .upsert({ id: user.id, status: "pending" }, { onConflict: "id", ignoreDuplicates: true })
    if (error) return { error: "Could not add driver access. Please retry." }
  } else {
    const { error } = await admin
      .from("customer_profiles")
      .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true })
    if (error) return { error: "Could not add customer access. Please retry." }
  }

  return { success: true }
}

/**
 * Called from /auth/callback after an OAuth sign-in.
 * Ensures the `users` table has a row for this user —
 * new OAuth users won't have one yet.
 * Returns the user's role so the callback can redirect correctly.
 */
export async function ensureOAuthUserProfile(): Promise<{ role: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { role: "customer", error: "Not authenticated" }

  try { return { role: await ensureVerifiedProfile(user) } }
  catch { return { role: "customer", error: "Your profile could not be loaded. Please retry." } }
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in failed. Please try again." }
  let role: string
  try { role = await ensureVerifiedProfile(user) }
  catch { await supabase.auth.signOut(); return { error: "Your account could not be loaded. Please retry or contact support." } }

  if (role === "admin") redirect("/dashboard/admin")
  if (role === "driver") redirect("/dashboard/driver")
  redirect("/dashboard/customer")
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const full_name = `${formData.get("first_name")} ${formData.get("last_name")}`.trim()
  // Never trust the submitted role beyond this allowlist — 'admin' (or
  // anything else) must never be reachable through public signup.
  const requestedRole = formData.get("role") as string
  const role = requestedRole === "driver" ? "driver" : "customer"
  const phone = (formData.get("phone") as string) || null
  const address = (formData.get("address") as string) || null

  const origin = await getAppOrigin()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Must point at this app's own callback route, which exchanges the
      // PKCE code for a session — NOT Supabase's project URL. Pointing at
      // the Supabase domain (or the bare app origin with no /auth/callback
      // path) leaves an unexchanged ?code= sitting in the address bar and
      // the user never gets signed in.
      emailRedirectTo: `${origin}/auth/callback?role=${role}`,
      data: { full_name, role, phone, address },
    },
  })

  if (error) return { error: error.message }

  // Auth's INSERT trigger initializes new profiles atomically. A duplicate
  // signup may return an obfuscated user; it must never update public records.

  return { success: true }
}

export async function signInAsDriver(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in failed. Please try again." }

  let role: string
  try { role = await ensureVerifiedProfile(user) }
  catch { await supabase.auth.signOut(); return { error: "Your account could not be loaded. Please retry or contact support." } }
  if (role !== "driver") {
    await supabase.auth.signOut()
    return { error: "No driver account found for this email address." }
  }

  redirect("/dashboard/driver")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function forgotPassword(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get("email") as string
  const origin = await getAppOrigin()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Same fix as signUp() above — must be this app's own page, not
    // Supabase's project URL.
    redirectTo: `${origin}/auth/callback?type=recovery`,
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get("password") as string

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  await supabase.auth.signOut()
  redirect("/login?reset=success")
}
