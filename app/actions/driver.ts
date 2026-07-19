"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export type SupportTicket = {
  id: string
  subject: string
  message: string
  status: "open" | "closed"
  created_at: string
}

export async function getMyTickets(): Promise<{ data: SupportTicket[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("support_tickets")
    .select("id, subject, message, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as SupportTicket[] }
}

export async function createSupportTicket(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const subject = (formData.get("subject") as string ?? "").trim()
  const message = (formData.get("message") as string ?? "").trim()
  if (!subject || !message) return { error: "Subject and message are required" }

  const admin = createAdminClient()
  const { error } = await admin.from("support_tickets").insert({
    user_id: user.id,
    subject,
    message,
    status: "open",
  })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/driver/support")
  revalidatePath("/dashboard/customer/support")
  return { success: true }
}

export async function updateVehicleInfo(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const vehicle_type = (formData.get("vehicle_type") as string ?? "").trim()
  const vehicle_number = (formData.get("vehicle_number") as string ?? "").trim()

  const admin = createAdminClient()
  const { error } = await admin
    .from("driver_profiles")
    .upsert({ id: user.id, vehicle_type, vehicle_number }, { onConflict: "id" })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/driver/profile")
  revalidatePath("/dashboard/driver/settings")
  return { success: true }
}

export async function toggleDriverOnline(isOnline: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  const { error } = await admin
    .from("driver_profiles")
    .upsert({ id: user.id, is_online: isOnline }, { onConflict: "id" })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/driver/settings")
  return { success: true }
}

/**
 * Save notification preferences.
 * Requires columns notifications_enabled and delivery_alerts on driver_profiles.
 * Run scripts/014_driver_settings.sql if these columns don't exist yet.
 */
export async function updateDriverNotifications(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const notifications_enabled = formData.get("notifications_enabled") === "1"
  const delivery_alerts       = formData.get("delivery_alerts")       === "1"

  const admin = createAdminClient()
  const { error } = await admin
    .from("driver_profiles")
    .upsert({ id: user.id, notifications_enabled, delivery_alerts }, { onConflict: "id" })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/driver/settings")
  return { success: true }
}

/** Change the driver's password via Supabase Auth admin API. */
export async function changeDriverPassword(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const newPassword     = (formData.get("new_password")     as string ?? "").trim()
  const confirmPassword = (formData.get("confirm_password") as string ?? "").trim()

  if (!newPassword)                    return { error: "New password is required" }
  if (newPassword.length < 8)          return { error: "Password must be at least 8 characters" }
  if (newPassword !== confirmPassword) return { error: "Passwords do not match" }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: newPassword })

  if (error) return { error: error.message }
  return { success: true }
}

export async function getDriverNamesByIds(driverIds: string[]): Promise<Record<string, string>> {
  if (driverIds.length === 0) return {}
  const admin = createAdminClient()
  const { data } = await admin
    .from("users")
    .select("id, full_name")
    .in("id", driverIds)
  const map: Record<string, string> = {}
  for (const u of data ?? []) {
    map[(u as any).id] = (u as any).full_name ?? "Driver"
  }
  return map
}
