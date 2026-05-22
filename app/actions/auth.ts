"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"

/**
 * Switch the user's active role and redirect to the matching dashboard.
 * The other profile's data is fully preserved.
 */
export async function switchActiveRole(newRole: "customer" | "driver") {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const admin = createAdminClient()
  await admin.from("users").update({ role: newRole }).eq("id", user.id)

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

  const admin = createAdminClient()

  if (newRole === "driver") {
    await admin
      .from("driver_profiles")
      .upsert({ id: user.id, status: "pending" }, { onConflict: "id" })
  } else {
    await admin
      .from("customer_profiles")
      .upsert({ id: user.id }, { onConflict: "id" })
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

  // Check if profile already exists (returning user)
  const { data: existing } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (existing) return { role: existing.role }

  // New OAuth user — create profile row
  const admin = createAdminClient()
  const meta = user.user_metadata ?? {}
  const full_name =
    meta.full_name || meta.name ||
    [meta.given_name, meta.family_name].filter(Boolean).join(" ") ||
    user.email?.split("@")[0] || "User"

  const role = "customer" // OAuth users default to customer

  await admin.from("users").upsert(
    { id: user.id, full_name, role, email: user.email },
    { onConflict: "id" }
  )
  await admin.from("customer_profiles").upsert(
    { id: user.id },
    { onConflict: "id" }
  )

  return { role }
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  // Fetch role and redirect based on it
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in failed. Please try again." }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  const role = profile?.role || "customer"

  if (role === "admin") redirect("/dashboard/admin")
  if (role === "driver") redirect("/dashboard/driver")
  redirect("/dashboard/customer")
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const full_name = `${formData.get("first_name")} ${formData.get("last_name")}`.trim()
  const role = (formData.get("role") as string) ?? "customer"
  const phone = (formData.get("phone") as string) || null
  const address = (formData.get("address") as string) || null

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback`}`,
      data: { full_name, role, phone },
    },
  })

  if (error) return { error: error.message }

  if (data.user) {
    const admin = createAdminClient()

    await admin
      .from("users")
      .upsert({ id: data.user.id, full_name, role, phone }, { onConflict: "id" })

    if (role === "driver") {
      await admin
        .from("driver_profiles")
        .upsert({ id: data.user.id, status: "pending" }, { onConflict: "id" })
    }

    if (role === "customer") {
      await admin
        .from("customer_profiles")
        .upsert({ id: data.user.id, default_address: address }, { onConflict: "id" })
    }
  }

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

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role !== "driver") {
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

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/reset-password`,
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get("password") as string

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  redirect("/login")
}
