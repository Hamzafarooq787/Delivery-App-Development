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
