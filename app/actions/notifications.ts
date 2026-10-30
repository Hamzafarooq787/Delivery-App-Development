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
