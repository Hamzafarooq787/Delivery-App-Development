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

    // Create a pending driver_profiles entry for driver signups
    if (role === "driver") {
      await supabase
        .from("driver_profiles")
        .upsert({ id: data.user.id, status: "pending" }, { onConflict: "id" })
    }
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
