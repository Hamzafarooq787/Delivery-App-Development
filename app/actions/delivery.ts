"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { notifyUser, notifyDriversOfNewDelivery } from "@/app/actions/notifications"
import { NotificationTag } from "@/lib/notifications/types"
import { isPackageSize, unionCapabilities, type PackageSize, type VehicleType } from "@/lib/vehicles"
import type { DriverVehicle } from "@/app/actions/vehicles"
import { getDeliveryQuote } from "@/app/actions/pricing"

// ── Customer actions ──────────────────────────────────────────────────────────

export type CreateDeliveryParams = {
  pickup_address: string
  delivery_address: string
  pickup_lat: number
  pickup_lng: number
  delivery_lat: number
  delivery_lng: number
  /** Optional — customers aren't required to describe the item. */
  item_description?: string
  item_photo_urls?: string[]
  package_size: PackageSize
  /** Optional — validated server-side; an invalid code is simply ignored, not an error. */
  promo_code?: string | null
}

export type CreateDeliveryResult =
  | { data: { id: string } }
  | { error: string; code?: "insufficient_funds" | "not_authenticated" | "invalid_price" }

/**
 * Creates a delivery request and pays for it from the customer's wallet in a
 * single atomic database transaction (see
 * scripts/024_promotions_and_surge_pricing.sql create_delivery_with_wallet_payment).
 *
 * The price is NEVER accepted from the client — it's recomputed here via
 * getDeliveryQuote(), the same authoritative pricing engine used for the
 * live quote shown while the customer fills out the form. This closes what
 * was previously a real gap: a client could otherwise call this action
 * directly with any price it wanted. Surge multipliers and discounts are
 * only meaningful if the server, not the browser, has the final say.
 */
export async function createDeliveryRequest(params: CreateDeliveryParams): Promise<CreateDeliveryResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated", code: "not_authenticated" }

  if (!isPackageSize(params.package_size)) {
    return { error: "Select a package size." }
  }

  const quoteResult = await getDeliveryQuote({
    pickupLat: params.pickup_lat,
    pickupLng: params.pickup_lng,
    deliveryLat: params.delivery_lat,
    deliveryLng: params.delivery_lng,
    packageSize: params.package_size,
    promoCode: params.promo_code,
  })

  if ("error" in quoteResult) {
    return { error: quoteResult.error, code: "invalid_price" }
  }
  const quote = quoteResult.data

  const tracking_number = `TRK-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  const { data: deliveryId, error } = await supabase.rpc("create_delivery_with_wallet_payment", {
    p_pickup_address: params.pickup_address,
    p_delivery_address: params.delivery_address,
    p_pickup_lat: params.pickup_lat,
    p_pickup_lng: params.pickup_lng,
    p_delivery_lat: params.delivery_lat,
    p_delivery_lng: params.delivery_lng,
    p_item_description: params.item_description?.trim() || null,
    p_price: quote.finalPrice,
    p_tracking_number: tracking_number,
    p_package_size: params.package_size,
    p_item_photo_urls: params.item_photo_urls && params.item_photo_urls.length > 0 ? params.item_photo_urls : null,
    p_base_price: quote.basePrice,
    p_surge_multiplier: quote.surgeMultiplier,
    p_discount_amount: quote.discountAmount,
    p_promo_code_id: quote.promoCodeId,
    p_promo_code: quote.promoCodeText,
  })

  if (error) {
    if (error.message?.includes("insufficient_funds")) {
      return { error: "Your wallet balance doesn't cover this delivery. Please add funds to continue.", code: "insufficient_funds" }
    }
    console.error("[Delivery] createDeliveryRequest RPC failed:", error)
    return { error: "Could not create the delivery. Please try again." }
  }

  revalidatePath("/dashboard/customer")
  revalidatePath("/dashboard/customer/active-deliveries")
  revalidatePath("/dashboard/customer/payments")
  revalidatePath("/dashboard/customer/wallet")

  // Notify online/approved drivers — fire-and-forget, don't block the response
  notifyDriversOfNewDelivery(deliveryId as string, params.pickup_address, params.package_size).catch((err) =>
    console.error("[Notify] Failed to send new-delivery push:", err)
  )

  return { data: { id: deliveryId as string } }
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
  const { data: { user } } = await supabase.auth.getUser()

  // Use admin client: RLS has no policy allowing drivers to read unassigned delivery_requests
  const admin = createAdminClient()

  // Driver Identity Verification — only approved drivers can see jobs at
  // all. This is defense-in-depth alongside the client-side onboarding
  // gate in DriverLayoutClient, which only hides the UI.
  if (user) {
    const { data: profile } = await admin.from("driver_profiles").select("status").eq("id", user.id).maybeSingle()
    if (profile?.status !== "approved") {
      return { error: "Your account must be verified before you can view available jobs.", data: [] }
    }
  }

  // Job matching: only show deliveries this driver's vehicles can carry.
  // Uses the UNION of capabilities across ALL of the driver's registered
  // vehicles — a driver with both a car and a van is matched to jobs either
  // one can handle, with no "active vehicle" switch.
  let allowedSizes: string[] = []
  if (user) {
    const { data: vehicles } = await admin
      .from("driver_vehicles")
      .select("vehicle_type")
      .eq("driver_id", user.id)
    const types = (vehicles ?? []).map((v) => v.vehicle_type as VehicleType)
    allowedSizes = unionCapabilities(types)
  }

  let query = admin
    .from("delivery_requests")
    .select("id, tracking_number, status, pickup_address, delivery_address, item_description, item_value, price, created_at, driver_id, pickup_lat, pickup_lng, package_size")
    .eq("status", "requested")
    .is("driver_id", null)
    .order("created_at", { ascending: false })

  // Legacy rows created before package_size existed have no size — shown to
  // everyone. Sized rows are filtered to what this driver's vehicles carry.
  query = allowedSizes.length > 0
    ? query.or(`package_size.is.null,package_size.in.(${allowedSizes.join(",")})`)
    : query.is("package_size", null)

  const { data, error } = await query

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

export async function acceptDelivery(deliveryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()

  // Driver Identity Verification — only approved drivers can accept jobs.
  const { data: driverProfile } = await admin.from("driver_profiles").select("status").eq("id", user.id).maybeSingle()
  if (driverProfile?.status !== "approved") {
    return { error: "Your account must be verified before you can accept jobs." }
  }

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

  // Payment before dispatch — defense-in-depth. Every delivery created
  // through createDeliveryRequest() already has a "paid" payments row
  // (inserted atomically with the delivery itself), but a driver must
  // never be able to accept a job that somehow doesn't, regardless of how
  // that happened.
  const { data: paidPayment } = await admin
    .from("payments")
    .select("id")
    .eq("delivery_id", deliveryId)
    .eq("status", "paid")
    .maybeSingle()
  if (!paidPayment) {
    return { error: "This delivery hasn't been paid for yet." }
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

  // ── Push notification: notify the customer their delivery was accepted ──────
  // Fetch the customer ID from the delivery record (fire-and-forget)
  admin
    .from("delivery_requests")
    .select("customer_id, tracking_number")
    .eq("id", deliveryId)
    .single()
    .then(({ data: deliveryData }) => {
      if (deliveryData?.customer_id) {
        notifyUser({
          userId: deliveryData.customer_id,
          title: "🚗 Driver on the way!",
          body: `Your delivery ${deliveryData.tracking_number ?? ""} has been accepted. Your driver is heading to collect the package.`,
          url: "/dashboard/customer",
          tag: `${NotificationTag.DELIVERY_ACCEPTED}-${deliveryId}`,
          data: { deliveryId },
        }).catch((err) => console.error("[Notify] Failed to send delivery-accepted push:", err))
      }
    })
    .catch(() => {/* silently ignore */})

  revalidatePath("/dashboard/driver/jobs/available")
  revalidatePath("/dashboard/driver/active-jobs")
  return { success: true, deliveryId: updatedDelivery.id }
}

export async function updateDeliveryStatus(deliveryId: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Marking a delivery "delivered" requires the customer's OTP — see
  // verifyDeliveryOtpAndComplete(). This action can never set that status
  // directly, so there's exactly one path to completion, and it's the one
  // that's actually gated.
  if (status === "delivered") {
    return { error: "Enter the customer's delivery code to confirm delivery." }
  }

  const updatePayload: Record<string, string> = { status }
  if (status === "cancelled") {
    updatePayload.cancelled_by = "driver"
  }

  let query = supabase
    .from("delivery_requests")
    .update(updatePayload)
    .eq("id", deliveryId)
    .eq("driver_id", user.id)

  // Forward-only transition guard — a driver can't jump straight to
  // in_transit without having collected the parcel first. Cancellation is
  // intentionally allowed from any active status, so it isn't restricted.
  if (status === "in_transit") {
    query = query.eq("status", "collected")
  }

  const { data: updatedRows, error } = await query.select("id")

  if (error) return { error: error.message }
  if (status === "in_transit" && (!updatedRows || updatedRows.length === 0)) {
    return { error: "This delivery must be collected before it can start." }
  }

  // Log status change
  await supabase.from("delivery_status_logs").insert({
    delivery_id: deliveryId,
    status,
    updated_by: user.id,
  })

  // ── Push notification: notify the customer of status updates ─────────────
  // Map delivery statuses to human-friendly push notification content
  const statusNotifications: Record<
    string,
    { title: string; body: string; tag: string }
  > = {
    collected: {
      title: "📦 Package collected!",
      body: "Your package has been collected and is on its way.",
      tag: NotificationTag.DELIVERY_COLLECTED,
    },
    in_transit: {
      title: "🚚 Package in transit",
      body: "Your delivery is en route to the destination.",
      tag: NotificationTag.DELIVERY_IN_TRANSIT,
    },
    cancelled: {
      title: "❌ Delivery cancelled",
      body: "Your delivery has been cancelled. Please contact support if needed.",
      tag: NotificationTag.DELIVERY_CANCELLED,
    },
  }

  const notifContent = statusNotifications[status]
  if (notifContent) {
    // Fetch customer_id to notify them (fire-and-forget)
    supabase
      .from("delivery_requests")
      .select("customer_id, tracking_number")
      .eq("id", deliveryId)
      .single()
      .then(({ data: delData }) => {
        if (delData?.customer_id) {
          notifyUser({
            userId: delData.customer_id,
            title: notifContent.title,
            body: `${notifContent.body} (${delData.tracking_number ?? deliveryId})`,
            url: "/dashboard/customer",
            tag: `${notifContent.tag}-${deliveryId}`,
            data: { deliveryId, status },
          }).catch((err) => console.error(`[Notify] Failed to send ${status} push:`, err))
        }
      })
      .catch(() => {/* silently ignore */})
  }

  // Auto-offline when a job is cancelled — if no other active jobs remain
  if (status === "cancelled") {
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

  revalidatePath("/dashboard/driver/jobs/completed")
  revalidatePath("/dashboard/driver/active-jobs")
  revalidatePath("/dashboard/driver/earnings")
  return { success: true }
}

// ── OTP / Delivery Verification ─────────────────────────────────────────────

const MAX_OTP_ATTEMPTS = 5

/**
 * Fetch the current delivery's OTP for the CUSTOMER to read out to their
 * driver. RLS-scoped via the regular authenticated client — only returns a
 * code if the caller actually owns this delivery. Never call this with the
 * admin client for a driver-facing surface.
 */
export async function getDeliveryOtp(deliveryId: string): Promise<{ data: string | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Not authenticated" }

  const { data, error } = await supabase
    .from("delivery_otps")
    .select("otp")
    .eq("delivery_id", deliveryId)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data: data?.otp ?? null }
}

/**
 * The ONLY way a delivery can be marked "delivered" — the driver submits the
 * code the customer read out to them. Verifies the driver is actually
 * assigned, the delivery is at the right stage, and the code matches, all
 * server-side. Attempts are capped at MAX_OTP_ATTEMPTS to resist brute force
 * (see adminResetDeliveryOtp for the support recovery path).
 */
export async function verifyDeliveryOtpAndComplete(
  deliveryId: string,
  code: string,
  photoUrl: string
): Promise<{ success?: boolean; error?: string; attemptsRemaining?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  if (!photoUrl?.trim()) {
    return { error: "A photo of the delivered package is required." }
  }

  const admin = createAdminClient()

  const { data: delivery, error: deliveryError } = await admin
    .from("delivery_requests")
    .select("id, status, driver_id, price, tracking_number, customer_id")
    .eq("id", deliveryId)
    .single()

  if (deliveryError || !delivery) return { error: "Delivery not found" }
  if (delivery.driver_id !== user.id) return { error: "This job isn't assigned to you" }
  if (delivery.status !== "in_transit") {
    return { error: "This delivery isn't ready to be marked delivered yet." }
  }

  const { data: otpRow, error: otpError } = await admin
    .from("delivery_otps")
    .select("otp, attempts")
    .eq("delivery_id", deliveryId)
    .maybeSingle()

  if (otpError || !otpRow) return { error: "Could not verify the code. Please contact support." }

  if (otpRow.attempts >= MAX_OTP_ATTEMPTS) {
    return { error: "Too many incorrect attempts. Please contact support for a new code.", attemptsRemaining: 0 }
  }

  if (code.trim() !== otpRow.otp) {
    const nextAttempts = otpRow.attempts + 1
    await admin.from("delivery_otps").update({ attempts: nextAttempts }).eq("delivery_id", deliveryId)
    const remaining = Math.max(0, MAX_OTP_ATTEMPTS - nextAttempts)
    return {
      error:
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "Too many incorrect attempts. Please contact support for a new code.",
      attemptsRemaining: remaining,
    }
  }

  // Correct code — mark delivered, but only if it's STILL in_transit and
  // STILL assigned to this driver (atomic guard against a race).
  const nowIso = new Date().toISOString()
  const { data: updatedRows, error: updateError } = await admin
    .from("delivery_requests")
    .update({ status: "delivered", delivered_at: nowIso, delivered_image_url: photoUrl.trim() })
    .eq("id", deliveryId)
    .eq("driver_id", user.id)
    .eq("status", "in_transit")
    .select("id")

  if (updateError) return { error: updateError.message }
  if (!updatedRows || updatedRows.length === 0) {
    return { error: "This delivery is no longer ready to be marked delivered." }
  }

  await admin.from("delivery_otps").update({ verified_at: nowIso }).eq("delivery_id", deliveryId)

  await admin.from("delivery_status_logs").insert({
    delivery_id: deliveryId,
    status: "delivered",
    updated_by: user.id,
  })

  // Record earnings with 75/25 commission split
  const price = Number(delivery.price ?? 0)
  if (price > 0) {
    const driverCut = Math.round(price * 0.75 * 100) / 100
    const commission = Math.round(price * 0.25 * 100) / 100
    await admin.from("driver_earnings").upsert(
      {
        driver_id: user.id,
        delivery_id: deliveryId,
        amount: driverCut,
        commission_amount: commission,
        status: "pending",
      },
      { onConflict: "delivery_id" }
    )
  }

  // Auto-offline if no other active jobs remain
  const ACTIVE = ["accepted", "collected", "picked_up", "in_transit"]
  const { count } = await admin
    .from("delivery_requests")
    .select("id", { count: "exact", head: true })
    .eq("driver_id", user.id)
    .in("status", ACTIVE)
  if ((count ?? 0) === 0) {
    await admin.from("driver_profiles").upsert({ id: user.id, is_online: false }, { onConflict: "id" })
  }

  if (delivery.customer_id) {
    notifyUser({
      userId: delivery.customer_id,
      title: "✅ Delivery complete!",
      body: `Your package has been delivered successfully. (${delivery.tracking_number ?? deliveryId})`,
      url: "/dashboard/customer",
      tag: `${NotificationTag.DELIVERY_DELIVERED}-${deliveryId}`,
      data: { deliveryId, status: "delivered" },
    }).catch((err) => console.error("[Notify] Failed to send delivered push:", err))
  }

  revalidatePath("/dashboard/driver/jobs/completed")
  revalidatePath("/dashboard/driver/active-jobs")
  revalidatePath("/dashboard/driver/earnings")
  revalidatePath("/dashboard/admin/orders")
  return { success: true }
}

/**
 * Admin recovery path — resets the attempt counter and issues a fresh code
 * when a driver has been locked out after too many incorrect entries.
 */
export async function adminResetDeliveryOtp(deliveryId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }
  const { data: adminRow } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
  if (adminRow?.role !== "admin") return { error: "Not authorized" }

  const admin = createAdminClient()
  const newOtp = Math.floor(Math.random() * 10000).toString().padStart(4, "0")
  const { error } = await admin
    .from("delivery_otps")
    .update({ otp: newOtp, attempts: 0, verified_at: null })
    .eq("delivery_id", deliveryId)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/admin/orders/${deliveryId}`)
  return { success: true }
}

export async function safetyReleaseJob(deliveryId: string, reason: string) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Release job back to the pool so another driver can accept it
  const { error } = await admin
    .from("delivery_requests")
    .update({ status: "requested", driver_id: null })
    .eq("id", deliveryId)
    .eq("driver_id", user.id)

  if (error) return { error: error.message }

  // Log the safety cancellation with reason
  await admin.from("delivery_status_logs").insert({
    delivery_id: deliveryId,
    status: `safety_release: ${reason}`,
    updated_by: user.id,
  })

  // Auto-offline if no other active jobs remain
  const ACTIVE = ["accepted", "collected", "picked_up", "in_transit"]
  const { count } = await admin
    .from("delivery_requests")
    .select("id", { count: "exact", head: true })
    .eq("driver_id", user.id)
    .in("status", ACTIVE)
  if ((count ?? 0) === 0) {
    await admin.from("driver_profiles").upsert({ id: user.id, is_online: false }, { onConflict: "id" })
  }

  revalidatePath("/dashboard/driver/jobs")
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

  // Payment before dispatch — an admin can unassign freely, but assigning a
  // driver requires the same payment guarantee as the normal accept flow.
  if (driverId) {
    const { data: paidPayment } = await admin
      .from("payments")
      .select("id")
      .eq("delivery_id", deliveryId)
      .eq("status", "paid")
      .maybeSingle()
    if (!paidPayment) {
      return { error: "This delivery hasn't been paid for yet — a driver can't be assigned." }
    }
  }

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

  const customerIds = users.map((u) => u.id)

  // Batch-fetch emails + delivery data in parallel (no N+1)
  const [authRes, deliveriesRes] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin
      .from("delivery_requests")
      .select("customer_id, price, status")
      .in("customer_id", customerIds),
  ])

  const emailMap = new Map((authRes.data?.users ?? []).map((u) => [u.id, u.email ?? ""]))

  // Aggregate delivery count (all statuses) and total spend (delivered = paid)
  const deliveryCountMap: Record<string, number> = {}
  const spendMap: Record<string, number> = {}
  for (const d of deliveriesRes.data ?? []) {
    if (!d.customer_id) continue
    deliveryCountMap[d.customer_id] = (deliveryCountMap[d.customer_id] ?? 0) + 1
    if (d.status === "delivered" && d.price) {
      spendMap[d.customer_id] = (spendMap[d.customer_id] ?? 0) + d.price
    }
  }

  return {
    data: users.map((u) => ({
      id: u.id,
      full_name: u.full_name ?? "",
      email: emailMap.get(u.id) ?? "",
      phone: u.phone ?? null,
      created_at: u.created_at,
      delivery_count: deliveryCountMap[u.id] ?? 0,
      total_spend: spendMap[u.id] ?? 0,
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

  const first     = (formData.get("first_name") as string ?? "").trim()
  const last      = (formData.get("last_name")  as string ?? "").trim()
  const full_name = last ? `${first} ${last}` : first
  const phone     = (formData.get("phone") as string ?? "").trim()

  if (!full_name) return { error: "Name is required" }

  // Use admin client to bypass any RLS restrictions on the users table
  const admin = createAdminClient()
  const { error } = await admin
    .from("users")
    .update({ full_name, phone })
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
  vehicles: DriverVehicle[]
  submitted_at: string
  documents: { document_type: string; file_url: string }[]
}

export async function adminGetPendingVerifications(): Promise<{ data: PendingVerificationDriver[]; error?: string }> {
  const admin = createAdminClient()

  const { data: profiles, error: profilesErr } = await admin
    .from("driver_profiles")
    .select("id, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (profilesErr) return { data: [], error: profilesErr.message }
  if (!profiles || profiles.length === 0) return { data: [] }

  const ids = profiles.map((p) => p.id)

  const [usersRes, docsRes, vehiclesRes, authRes] = await Promise.all([
    admin.from("users").select("id, full_name, phone, email").in("id", ids),
    admin.from("driver_documents").select("driver_id, document_type, file_url").in("driver_id", ids),
    admin.from("driver_vehicles").select(
      "id, driver_id, vehicle_type, make, model, colour, registration_number, driving_licence_details, insurance_details, created_at"
    ).in("driver_id", ids),
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
  const vehiclesMap = new Map<string, DriverVehicle[]>()
  for (const v of vehiclesRes.data ?? []) {
    const { driver_id, ...vehicle } = v
    const arr = vehiclesMap.get(driver_id) ?? []
    arr.push(vehicle as DriverVehicle)
    vehiclesMap.set(driver_id, arr)
  }

  const data: PendingVerificationDriver[] = profiles.map((p) => {
    const u = userMap.get(p.id)
    return {
      id: p.id,
      full_name: u?.full_name ?? "Unknown",
      email: emailMap.get(p.id) ?? u?.email ?? "",
      phone: u?.phone ?? "",
      vehicles: vehiclesMap.get(p.id) ?? [],
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

export async function uploadParcelPhotoAndCollect(deliveryId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const file = formData.get('photo') as File
  if (!file || file.size === 0) return { error: 'No photo provided' }

  const path = `${user.id}/parcel-${deliveryId}-${Date.now()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from('driver-documents')
    .upload(path, file, { contentType: 'image/jpeg', upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = supabase.storage.from('driver-documents').getPublicUrl(path)

  const { error } = await supabase
    .from('delivery_requests')
    .update({ status: 'collected', parcel_image_url: publicUrl })
    .eq('id', deliveryId)
    .eq('driver_id', user.id)

  if (error) return { error: error.message }

  await supabase.from('delivery_status_logs').insert({
    delivery_id: deliveryId,
    status: 'collected',
    updated_by: user.id,
  })

  revalidatePath(`/dashboard/driver/jobs/${deliveryId}`)
  return { success: true, photoUrl: publicUrl }
}

// Lightweight version: photo already uploaded client-side, just record URL + advance status
export async function markParcelCollected(deliveryId: string, photoUrl: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('delivery_requests')
    .update({ status: 'collected', parcel_image_url: photoUrl })
    .eq('id', deliveryId)
    .eq('driver_id', user.id)

  if (error) return { error: error.message }

  await supabase.from('delivery_status_logs').insert({
    delivery_id: deliveryId,
    status: 'collected',
    updated_by: user.id,
  })

  revalidatePath(`/dashboard/driver/jobs/${deliveryId}`)
  return { success: true }
}
