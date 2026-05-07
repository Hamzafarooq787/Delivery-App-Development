"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
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
  // Use admin client: RLS has no policy allowing drivers to read unassigned delivery_requests
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("delivery_requests")
    .select("id, tracking_number, status, pickup_address, delivery_address, item_description, item_value, price, created_at, driver_id")
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

  const admin = createAdminClient()

  // Verify the delivery is still available
  const { data: delivery, error: fetchError } = await admin
    .from("delivery_requests")
    .select("id, status, driver_id")
    .eq("id", deliveryId)
    .single()

  if (fetchError) return { error: fetchError.message }

  if (delivery.status !== "requested" || delivery.driver_id) {
    return { error: "This job is no longer available to accept." }
  }

  // Claim the delivery atomically — only succeeds if still unassigned
  const { data: updatedDelivery, error } = await admin
    .from("delivery_requests")
    .update({ driver_id: user.id, status: "accepted" })
    .eq("id", deliveryId)
    .eq("status", "requested")
    .is("driver_id", null)
    .select("id")
    .maybeSingle()

  if (error) return { error: error.message }
  if (!updatedDelivery) return { error: "This job was already accepted by another driver." }

  // Auto-set driver online when they accept a job
  await admin
    .from("driver_profiles")
    .upsert({ id: user.id, is_online: true }, { onConflict: "id" })

  revalidatePath("/dashboard/driver/jobs/available")
  revalidatePath("/dashboard/driver/jobs/active")
  revalidatePath("/dashboard/driver/active-jobs")
  return { success: true, deliveryId: updatedDelivery.id }
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

  // Auto-offline when job is completed or cancelled — if no other active jobs remain
  if (status === "delivered" || status === "cancelled") {
    const admin = createAdminClient()
    const ACTIVE = ["accepted", "collected", "picked_up", "in_transit"]
    const { count } = await admin
      .from("delivery_requests")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", user.id)
      .in("status", ACTIVE)
    if ((count ?? 0) === 0) {
      await admin
        .from("driver_profiles")
        .upsert({ id: user.id, is_online: false }, { onConflict: "id" })
    }
  }

  revalidatePath("/driver/jobs/active")
  revalidatePath("/driver/jobs/completed")
  revalidatePath("/dashboard/driver/active-jobs")
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

export async function adminGetDrivers() {
  const admin = createAdminClient()

  // Fetch both sources in parallel: driver_profiles rows AND users with role='driver'
  const [profilesRes, driverUsersRes, authData] = await Promise.all([
    admin.from("driver_profiles").select("id, status, created_at"),
    admin.from("users").select("id, full_name, phone, created_at").eq("role", "driver"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const profiles = profilesRes.data ?? []
  const driverUsers = driverUsersRes.data ?? []
  const emailMap = new Map((authData.data?.users ?? []).map((u) => [u.id, u.email ?? ""]))

  // Merge: start with all users who have role='driver', supplement with driver_profiles
  const profileMap = new Map(profiles.map((p) => [p.id, p]))
  const userMap = new Map(driverUsers.map((u) => [u.id, u]))

  // Collect every unique driver id from either source
  const allIds = new Set([...profiles.map((p) => p.id), ...driverUsers.map((u) => u.id)])

  // For users with role='driver' who have no driver_profiles row, create one now
  const missingProfileIds = driverUsers
    .filter((u) => !profileMap.has(u.id))
    .map((u) => u.id)

  if (missingProfileIds.length > 0) {
    await admin
      .from("driver_profiles")
      .upsert(
        missingProfileIds.map((id) => ({ id, status: "pending" })),
        { onConflict: "id" }
      )
    missingProfileIds.forEach((id) => profileMap.set(id, { id, status: "pending", created_at: new Date().toISOString() }))
  }

  const drivers = Array.from(allIds).map((id) => {
    const u = userMap.get(id)
    const p = profileMap.get(id)
    return {
      id,
      full_name: u?.full_name ?? "Unknown Driver",
      email: emailMap.get(id) ?? "",
      phone: u?.phone ?? null,
      created_at: u?.created_at ?? p?.created_at ?? new Date().toISOString(),
      status: (p?.status ?? "pending") as "pending" | "approved" | "rejected",
    }
  })

  // Sort newest first
  drivers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return { data: drivers }
}

export async function adminCreateDriver(formData: FormData) {
  const admin = createAdminClient()

  const email = (formData.get("email") as string).trim()
  const full_name = (formData.get("full_name") as string).trim()
  const phone = ((formData.get("phone") as string) ?? "").trim() || null

  if (!email || !full_name) return { error: "Name and email are required" }

  // Check if user already exists in auth
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existing = authList?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

  let userId: string

  if (existing) {
    userId = existing.id
    // Update role to driver in case they were a customer
    await admin.from("users").upsert({ id: userId, full_name, phone, role: "driver" }, { onConflict: "id" })
  } else {
    // Create new auth user with a temporary password they can reset
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name, role: "driver", phone },
    })
    if (createError || !newUser.user) return { error: createError?.message ?? "Failed to create user" }
    userId = newUser.user.id
    await admin.from("users").upsert({ id: userId, full_name, phone, role: "driver" }, { onConflict: "id" })
  }

  // Ensure driver_profiles row exists
  await admin.from("driver_profiles").upsert({ id: userId, status: "pending" }, { onConflict: "id" })

  revalidatePath("/dashboard/admin/drivers")
  return { success: true }
}

export async function adminApproveDriver(driverId: string) {
  const admin = createAdminClient()

  const { error } = await admin
    .from("driver_profiles")
    .upsert({ id: driverId, status: "approved" }, { onConflict: "id" })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/drivers")
  revalidatePath(`/dashboard/admin/drivers/${driverId}`)
  revalidatePath("/dashboard/admin/verification")
  return { success: true }
}

export async function adminRejectDriver(driverId: string) {
  const admin = createAdminClient()

  const { error } = await admin
    .from("driver_profiles")
    .upsert({ id: driverId, status: "rejected" }, { onConflict: "id" })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/drivers")
  revalidatePath(`/dashboard/admin/drivers/${driverId}`)
  revalidatePath("/dashboard/admin/verification")
  return { success: true }
}

export async function adminAssignDriver(deliveryId: string, driverId: string | null) {
  const admin = createAdminClient()

  const update: Record<string, string | null> =
    driverId
      ? { driver_id: driverId, status: "accepted" }
      : { driver_id: null, status: "requested" }

  const { error } = await admin
    .from("delivery_requests")
    .update(update)
    .eq("id", deliveryId)

  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/orders")
  revalidatePath(`/dashboard/admin/orders/${deliveryId}`)
  return { success: true }
}

export async function adminGetCustomers() {
  const admin = createAdminClient()

  // Get all users with role = customer from public.users
  const { data: users, error } = await admin
    .from("users")
    .select("id, full_name, phone, created_at")
    .eq("role", "customer")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return { error: error.message, data: [] }
  if (!users || users.length === 0) return { data: [] }

  // Get emails from auth.users (email column doesn't exist in public.users)
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map((authData?.users ?? []).map((u) => [u.id, u.email ?? ""]))

  return {
    data: users.map((u) => ({
      id: u.id,
      full_name: u.full_name ?? "",
      email: emailMap.get(u.id) ?? "",
      phone: u.phone ?? null,
      created_at: u.created_at,
    })),
  }
}

export async function adminGetDriverById(driverId: string) {
  const admin = createAdminClient()

  const [userRes, profileRes, earningsRes, jobsRes, authUserRes] = await Promise.all([
    admin.from("users").select("id, full_name, phone, created_at").eq("id", driverId).single(),
    admin.from("driver_profiles").select("status, created_at").eq("id", driverId).single(),
    admin.from("driver_earnings").select("amount").eq("driver_id", driverId),
    admin.from("delivery_requests").select("id", { count: "exact", head: true }).eq("driver_id", driverId).eq("status", "delivered"),
    admin.auth.admin.getUserById(driverId),
  ])

  if (userRes.error || !userRes.data) return { error: "Driver not found", data: null }

  return {
    data: {
      id: userRes.data.id,
      full_name: userRes.data.full_name ?? "Unknown Driver",
      email: authUserRes.data?.user?.email ?? "",
      phone: userRes.data.phone ?? null,
      created_at: userRes.data.created_at,
      status: (profileRes.data?.status ?? "pending") as "pending" | "approved" | "rejected",
      totalEarned: (earningsRes.data ?? []).reduce((s, e) => s + (e.amount ?? 0), 0),
      jobsCompleted: jobsRes.count ?? 0,
    },
  }
}

export async function adminSaveSettings(formData: FormData) {
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
  revalidatePath("/dashboard/admin/settings")
  return { success: true }
}

export async function updateDriverProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const first = (formData.get("first_name") as string ?? "").trim()
  const last = (formData.get("last_name") as string ?? "").trim()
  const full_name = last ? `${first} ${last}` : first

  const { error } = await supabase
    .from("users")
    .update({ full_name, phone: formData.get("phone") as string })
    .eq("id", user.id)

  if (error) return { error: error.message }
  revalidatePath("/dashboard/driver/profile")
  revalidatePath("/dashboard/driver/settings")
  return { success: true }
}

export async function getDriverPayouts() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated", data: [] }

  const { data, error } = await supabase
    .from("payouts")
    .select("*")
    .eq("driver_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

export type PendingVerificationDriver = {
  id: string
  full_name: string
  email: string
  phone: string
  vehicle_type: string
  vehicle_number: string
  submitted_at: string
  documents: { document_type: string; file_url: string }[]
}

export async function adminGetPendingVerifications(): Promise<{ data: PendingVerificationDriver[]; error?: string }> {
  const admin = createAdminClient()

  const { data: profiles, error: profilesErr } = await admin
    .from("driver_profiles")
    .select("id, vehicle_type, vehicle_number, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (profilesErr) return { data: [], error: profilesErr.message }
  if (!profiles || profiles.length === 0) return { data: [] }

  const ids = profiles.map((p) => p.id)

  const [usersRes, docsRes, authRes] = await Promise.all([
    admin.from("users").select("id, full_name, phone, email").in("id", ids),
    admin.from("driver_documents").select("driver_id, document_type, file_url").in("driver_id", ids),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const emailMap = new Map(
    (authRes.data?.users ?? []).map((u) => [u.id, u.email ?? ""])
  )
  const userMap = new Map((usersRes.data ?? []).map((u) => [u.id, u]))
  const docsMap = new Map<string, { document_type: string; file_url: string }[]>()
  for (const doc of docsRes.data ?? []) {
    const arr = docsMap.get(doc.driver_id) ?? []
    arr.push({ document_type: doc.document_type, file_url: doc.file_url })
    docsMap.set(doc.driver_id, arr)
  }

  const data: PendingVerificationDriver[] = profiles.map((p) => {
    const u = userMap.get(p.id)
    return {
      id: p.id,
      full_name: u?.full_name ?? "Unknown",
      email: emailMap.get(p.id) ?? u?.email ?? "",
      phone: u?.phone ?? "",
      vehicle_type: p.vehicle_type ?? "",
      vehicle_number: p.vehicle_number ?? "",
      submitted_at: p.created_at ?? "",
      documents: docsMap.get(p.id) ?? [],
    }
  })

  return { data }
}

export async function adminGetPendingVerificationCount(): Promise<number> {
  const admin = createAdminClient()
  const { count } = await admin
    .from("driver_profiles")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
  return count ?? 0
}

export async function adminGetPayoutsWithDrivers() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("payouts")
    .select("*, users(full_name, email)")
    .order("created_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}
