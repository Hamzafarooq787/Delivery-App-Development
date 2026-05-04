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

  // STEP 1 — FULL LOGGING
  const { data: { user } } = await supabase.auth.getUser()
  console.log("[v0] AUTH USER:", user)

  if (!user) {
    console.error("[v0] NO AUTH USER")
    return { error: "Sign in failed. Please try again." }
  }

  // STEP 4 — VERIFY MATCHING ID
  console.log("[v0] AUTH ID:", user.id)

  // Fetch the FULL row (not just role) to see exactly what's stored
  const { data, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  console.log("[v0] FULL USER ROW:", data)
  console.log("[v0] ROLE:", data?.role)
  console.log("[v0] ERROR:", fetchError)

  // STEP 2 — REMOVE FALLBACK TEMPORARILY
  if (!data) {
    console.error("[v0] NO USER ROW FOUND")
    return { error: "No user row found in public.users" }
  }

  const role = data.role

  // STEP 3 — FORCE HARD REDIRECT TEST (log only, no redirect yet)
  if (role === "admin") {
    console.log("[v0] REDIRECT ADMIN")
  }
  if (role === "driver") {
    console.log("[v0] REDIRECT DRIVER")
  }
  if (role === "customer") {
    console.log("[v0] REDIRECT CUSTOMER")
  }

  // Return the diagnostic result to the client so we can also see it in the browser
  return {
    error: `DIAGNOSTIC: authId=${user.id} | rowId=${data.id} | role=${role} | match=${user.id === data.id}`,
  }
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
