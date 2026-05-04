"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// ── Customer actions ──────────────────────────────────────────────────────────

export async function createDeliveryRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const payload = {
    customer_id: user.id,
    pickup_address: formData.get("pickup_address") as string,
    delivery_address: formData.get("delivery_address") as string,
    pickup_lat: parseFloat(formData.get("pickup_lat") as string) || 0,
    pickup_lng: parseFloat(formData.get("pickup_lng") as string) || 0,
    delivery_lat: parseFloat(formData.get("delivery_lat") as string) || 0,
    delivery_lng: parseFloat(formData.get("delivery_lng") as string) || 0,
    item_description: formData.get("item_description") as string,
    item_value: parseFloat(formData.get("item_value") as string) || 0,
    price: parseFloat(formData.get("price") as string) || 0,
    is_safe_confirmed: formData.get("is_safe_confirmed") === "true",
    status: "requested",
    tracking_number: `TRK-${Date.now()}`,
  }

  const { data, error } = await supabase
    .from("delivery_requests")
    .insert(payload)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath("/customer/orders")
  return { data }
}

export async function getCustomerDeliveries() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated", data: [] }

  const { data, error } = await supabase
    .from("delivery_requests")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

export async function getDeliveryById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("delivery_requests")
    .select("*")
    .eq("id", id)
    .single()

  if (error) return { error: error.message, data: null }
  return { data }
}

export async function updateUserProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("users")
    .update({
      full_name: formData.get("full_name") as string,
      phone: formData.get("phone") as string,
    })
    .eq("id", user.id)

  if (error) return { error: error.message }
  revalidatePath("/customer/profile")
  return { success: true }
}

export async function submitSupportTicket(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("support_tickets").insert({
    user_id: user.id,
    subject: formData.get("subject") as string,
    message: formData.get("message") as string,
    status: "open",
  })

  if (error) return { error: error.message }
  return { success: true }
}

// ── Driver actions ────────────────────────────────────────────────────────────

export async function getAvailableDeliveries() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("delivery_requests")
    .select("*")
    .eq("status", "requested")
    .is("driver_id", null)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

export async function acceptDelivery(deliveryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: delivery, error: fetchError } = await supabase
    .from("delivery_requests")
    .select("id, status, driver_id")
    .eq("id", deliveryId)
    .single()

  if (fetchError) {
    console.error("[acceptDelivery] fetch error:", fetchError)
    return { error: fetchError.message }
  }

  if (delivery.status !== "requested" || delivery.driver_id) {
    return { error: "This job is no longer available to accept." }
  }

  const { data: updatedDelivery, error } = await supabase
    .from("delivery_requests")
    .update({ driver_id: user.id, status: "accepted" })
    .eq("id", deliveryId)
    .eq("status", "requested")
    .is("driver_id", null)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[acceptDelivery] update error:", error)
    return { error: error.message }
  }

  if (!updatedDelivery) {
    return { error: "This job was already accepted by another driver." }
  }

  revalidatePath("/dashboard/driver/jobs/available")
  revalidatePath("/dashboard/driver/active-jobs")
  return { success: true }
}

export async function updateDeliveryStatus(deliveryId: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("delivery_requests")
    .update({ status })
    .eq("id", deliveryId)
    .eq("driver_id", user.id)

  if (error) return { error: error.message }

  // Log status change
  await supabase.from("delivery_status_logs").insert({
    delivery_id: deliveryId,
    status,
    updated_by: user.id,
  })

  revalidatePath("/driver/jobs/active")
  revalidatePath("/driver/jobs/completed")
  return { success: true }
}

export async function getDriverDeliveries(statusFilter?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated", data: [] }

  let query = supabase
    .from("delivery_requests")
    .select("*")
    .eq("driver_id", user.id)
    .order("created_at", { ascending: false })

  if (statusFilter) {
    query = query.eq("status", statusFilter)
  }

  const { data, error } = await query
  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

export async function getDriverEarnings() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated", data: [] }

  const { data, error } = await supabase
    .from("driver_earnings")
    .select("*, delivery_requests(pickup_address, delivery_address, created_at)")
    .eq("driver_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

// ── Admin actions ─────────────────────────────────────────────────────────────

export async function adminGetAllDeliveries() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("delivery_requests")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

export async function adminGetAllUsers(role?: string) {
  const supabase = await createClient()

  let query = supabase.from("users").select("*").order("created_at", { ascending: false })
  if (role) query = query.eq("role", role)

  const { data, error } = await query
  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

export async function adminGetDisputes() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("disputes")
    .select("*, delivery_requests(tracking_number, pickup_address, delivery_address)")
    .order("created_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

export async function adminUpdateDisputeStatus(id: string, status: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("disputes")
    .update({ status })
    .eq("id", id)

  if (error) return { error: error.message }
  revalidatePath("/admin/disputes")
  return { success: true }
}

export async function adminGetPayments() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("payments")
    .select("*, delivery_requests(tracking_number)")
    .order("created_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

export async function adminGetPayouts() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("payouts")
    .select("*, users(full_name)")
    .order("created_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}
