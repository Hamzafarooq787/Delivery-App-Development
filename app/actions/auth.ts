"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAppOrigin } from "@/lib/get-app-origin"
import { normaliseUKMobile, UK_MOBILE_ERROR } from "@/lib/uk-phone"
import { ensureVerifiedProfile } from "@/lib/auth-profile"
import { signupEmailPending, signupEmailRequested, signupEmailAddress } from "@/lib/signup-email"
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

async function passwordSignIn(formData: FormData, driverOnly = false) {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  if (!email || !password) return { error: "Enter your email and password." }
  const deadline = AbortSignal.timeout(11000)
  const fetchBeforeDeadline: typeof fetch = (input, options) => fetch(input, {
    ...options, signal: options?.signal ? AbortSignal.any([deadline, options.signal]) : deadline,
  })
  const supabase = await createClient(fetchBeforeDeadline)
  let role: string
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: deadline.aborted || error.name === "AuthRetryableFetchError"
      ? "Sign-in is taking too long. Please try again." : error.message }
    if (!data.user || !data.session) return { error: "Sign in failed. Please try again." }

    const db = createAdminClient(fetchBeforeDeadline)
    const existing = await db.from("users").select("role,account_status").eq("id",data.user.id).maybeSingle()
    if (existing.error) throw existing.error
    if (existing.data && (existing.data.account_status !== "active" || !["admin","driver","customer"].includes(existing.data.role))) {
      throw new Error("Account unavailable")
    }
    role = existing.data?.role ?? await ensureVerifiedProfile(data.user, "customer", db)
    if (driverOnly && role !== "driver") {
      await supabase.auth.signOut({scope:"local"})
      return { error: "No driver account found for this email address." }
    }
  } catch {
    await supabase.auth.signOut({scope:"local"}).catch(() => {})
    return { error: "Your account could not be loaded. Please retry or contact support." }
  }
  return { role }
}

export async function signIn(formData: FormData) {
  const result = await passwordSignIn(formData)
  if (result.error) return { error: result.error }
  if (result.role === "admin") redirect("/dashboard/admin")
  if (result.role === "driver") redirect("/dashboard/driver")
  redirect("/dashboard/customer")
}

export async function signUp(formData: FormData) {
  const email = signupEmailAddress(formData.get("email"))
  const password = String(formData.get("password") ?? "")
  const full_name = [formData.get("first_name"), formData.get("last_name")].join(" ").trim()
  const role = formData.get("role") === "driver" ? "driver" : "customer"
  const phone = normaliseUKMobile(formData.get("phone"))
  if (!phone) return { error: UK_MOBILE_ERROR }
  if (!full_name || !email || password.length < 8 || password.length > 256) {
    return { error: "Enter your name, a valid email address and a password of at least 8 characters." }
  }
  const address = String(formData.get("address") ?? "").trim().slice(0, 1000) || null
  const deadline = AbortSignal.timeout(10000)

  try {
    const supabase = await createClient((input, options) => fetch(input, {
      ...options,
      signal: options?.signal ? AbortSignal.any([deadline, options.signal]) : deadline,
    }))
    const origin = await getAppOrigin()
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${origin}/auth/confirm`,
        data: { full_name: full_name.slice(0, 160), role, phone, address },
      },
    })
    if (error) {
      if (error.status === 429) return { error: "Too many signup attempts. Wait a few minutes and try again." }
      if (error.code === "email_address_not_authorized") return { error: "We could not send confirmation to this email address. Please contact GoDrop support." }
      if (error.code === "weak_password") return { error: "Choose a stronger password and try again." }
      if (error.code === "email_address_invalid") return { error: "Enter a valid email address and try again." }
      if (error.code === "user_already_exists") return signupEmailRequested
      if ((error.status ?? 0) >= 500 || error.name === "AuthRetryableFetchError" || deadline.aborted) return signupEmailRequested
      return { error: "Signup could not be completed. Please try again or contact support." }
    }
    // The Auth insert trigger creates the role profile, including a pending
    // driver. Never write profiles from an unverified or obfuscated response.
    if (!data?.user || data.user.identities?.length === 0) return signupEmailRequested
    return data.session ? { success: true as const, next: role } : signupEmailPending
  } catch {
    return signupEmailRequested
  }
}

export async function signInAsDriver(formData: FormData) {
  const result = await passwordSignIn(formData, true)
  if (result.error) return { error: result.error }
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
