/**
 * app/actions/notifications.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server actions for push notifications.
 * These are "use server" functions callable from server components or other
 * server actions (e.g., delivery.ts, driver.ts).
 *
 * Key exports:
 *   saveDeviceToken()    — persist an FCM token after it's generated client-side
 *   removeDeviceToken()  — delete token(s) on logout / opt-out
 *   notifyUser()         — send a push to ONE user (all their devices)
 *   notifyMultipleUsers() — broadcast to MANY users
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isPackageSize, VEHICLE_CAPABILITIES, type VehicleType } from "@/lib/vehicles"
import {
  sendPushNotification,
  sendPushNotificationToMultipleUsers,
} from "@/lib/notifications/send"
import type { MulticastResult, UserNotificationResult } from "@/lib/notifications/types"

// ── Token management ──────────────────────────────────────────────────────────

/**
 * Save an FCM device token for the currently authenticated user.
 * Idempotent — calling with the same token twice is safe.
 *
 * @param token      FCM registration token from getToken()
 * @param deviceType "web" | "mobile" | "desktop"
 */
export async function saveDeviceToken(
  token: string,
  deviceType: "web" | "mobile" | "desktop" = "web"
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  const { error } = await admin
    .from("user_notification_tokens")
    .upsert(
      {
        user_id: user.id,
        fcm_token: token,
        device_type: deviceType,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,fcm_token" }
    )

  if (error) {
    console.error("[Actions/notifications] saveDeviceToken:", error)
    return { error: error.message }
  }

  return { success: true }
}

/**
 * Remove FCM token(s) for the currently authenticated user.
 *
 * @param token  Specific token to remove. Omit to remove ALL tokens (full logout).
 */
export async function removeDeviceToken(token?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  let query = admin
    .from("user_notification_tokens")
    .delete()
    .eq("user_id", user.id)

  if (token) {
    query = query.eq("fcm_token", token) as typeof query
  }

  const { error } = await query
  if (error) return { error: error.message }
  return { success: true }
}

// ── Notification senders ──────────────────────────────────────────────────────

/**
 * Send a push notification to a specific user by their Supabase user ID.
 * Call this from any server action that needs to trigger a push.
 *
 * @example
 * // In delivery.ts — when a driver accepts a job, notify the customer:
 * await notifyUser({
 *   userId: delivery.customer_id,
 *   title: "Driver on the way!",
 *   body: "Your delivery has been accepted and the driver is heading to you.",
 *   url: `/dashboard/customer`,
 *   tag: "delivery-accepted",
 * })
 */
export async function notifyUser({
  userId,
  title,
  body,
  url = "/",
  tag,
  data,
}: {
  userId: string
  title: string
  body: string
  url?: string
  tag?: string
  data?: Record<string, string>
}): Promise<MulticastResult> {
  try {
    return await sendPushNotification({
      userId,
      notification: { title, body, url, tag, data },
    })
  } catch (error) {
    console.error("[Actions/notifications] notifyUser:", error)
    return { successCount: 0, failureCount: 0, failedTokens: [] }
  }
}

/**
 * Notify all approved, online drivers about a newly created delivery whose
 * vehicle(s) can carry it. Called from createDeliveryRequest() after insert.
 *
 * @param deliveryId    UUID of the newly inserted delivery_requests row
 * @param pickupAddress Human-readable pickup address (truncated to 60 chars in body)
 * @param packageSize   The delivery's package size — drivers are only
 *   notified if at least one of their registered vehicles can carry it.
 *   Omit/null for legacy deliveries with no size (notifies everyone, as before).
 */
export async function notifyDriversOfNewDelivery(
  deliveryId: string,
  pickupAddress: string,
  packageSize?: string | null
): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data: onlineDrivers } = await admin
      .from("driver_profiles")
      .select("id")
      .eq("status", "approved")
      .eq("is_online", true)

    if (!onlineDrivers || onlineDrivers.length === 0) {
      console.log("[Notify] notifyDriversOfNewDelivery: no online/approved drivers")
      return
    }

    let driverIds = onlineDrivers.map((d: { id: string }) => d.id)

    // Job matching: narrow to drivers whose vehicle(s) can carry this size.
    if (packageSize && isPackageSize(packageSize)) {
      const { data: vehicles } = await admin
        .from("driver_vehicles")
        .select("driver_id, vehicle_type")
        .in("driver_id", driverIds)

      const matchingIds = new Set<string>()
      for (const v of vehicles ?? []) {
        const caps = VEHICLE_CAPABILITIES[v.vehicle_type as VehicleType] ?? []
        if (caps.includes(packageSize)) matchingIds.add(v.driver_id)
      }
      driverIds = driverIds.filter((id) => matchingIds.has(id))
    }

    if (driverIds.length === 0) {
      console.log("[Notify] notifyDriversOfNewDelivery: no online drivers with a matching vehicle")
      return
    }

    console.log(`[Notify] notifyDriversOfNewDelivery: notifying ${driverIds.length} driver(s) for delivery ${deliveryId}`)

    await sendPushNotificationToMultipleUsers({
      userIds: driverIds,
      notification: {
        title: "📦 New delivery available!",
        body: `Pickup: ${pickupAddress.slice(0, 60)}`,
        url: "/dashboard/driver",
        tag: `new-delivery-${deliveryId}`,
        data: { deliveryId },
      },
    })
  } catch (error) {
    console.error("[Notify] notifyDriversOfNewDelivery failed:", error)
  }
}

/**
 * Broadcast a push notification to multiple users at once.
 * Useful for notifying all available drivers about a new order.
 *
 * @example
 * const onlineDriverIds = drivers.map(d => d.id)
 * await notifyMultipleUsers({
 *   userIds: onlineDriverIds,
 *   title: "New delivery available!",
 *   body: "Open the app to accept.",
 *   url: "/dashboard/driver",
 *   tag: "new-delivery",
 * })
 */
export async function notifyMultipleUsers({
  userIds,
  title,
  body,
  url = "/",
  tag,
  data,
}: {
  userIds: string[]
  title: string
  body: string
  url?: string
  tag?: string
  data?: Record<string, string>
}): Promise<UserNotificationResult[]> {
  try {
    return await sendPushNotificationToMultipleUsers({
      userIds,
      notification: { title, body, url, tag, data },
    })
  } catch (error) {
    console.error("[Actions/notifications] notifyMultipleUsers:", error)
    return []
  }
}
