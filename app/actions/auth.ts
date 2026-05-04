"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function signIn(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  // Fetch role to redirect correctly
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in failed. Please try again." }

  console.log("[v0] Server action - User ID:", user.id)

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  console.log("[v0] Server action - Profile data:", profile)
  console.log("[v0] Server action - Profile error:", profileError)

  // Log error for debugging but don't block login
  if (profileError) {
    console.error("Role fetch error:", profileError)
  }

  // Fallback to customer role if fetch fails or no data
  const role = profile?.role || "customer"
  console.log("[v0] Server action - Resolved role:", role)

  if (role === "admin") {
    console.log("[v0] Server action - Redirecting to /dashboard/admin")
    redirect("/dashboard/admin")
  }
  if (role === "driver") {
    console.log("[v0] Server action - Redirecting to /dashboard/driver")
    redirect("/dashboard/driver")
  }
  console.log("[v0] Server action - Redirecting to /dashboard/customer")
  redirect("/dashboard/customer")
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const full_name = `${formData.get("first_name")} ${formData.get("last_name")}`.trim()
  const role = (formData.get("role") as string) ?? "customer"
  const phone = (formData.get("phone") as string) ?? null

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback`}`,
      data: { full_name, role, phone },
    },
  })

  if (error) return { error: error.message }

  // Update the users row created by trigger with full_name, role, phone
  if (data.user) {
    await supabase
      .from("users")
      .update({ full_name, role, phone })
      .eq("id", data.user.id)
  }

  return { success: true }
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
