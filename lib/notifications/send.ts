import {recordDispatchFailure} from "@/lib/dispatch-failures"
import {recordHealth} from "@/lib/integration-health"
/**
 * lib/notifications/send.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side push notification utilities using Firebase Admin SDK.
 *
 * ⚠️  SERVER-SIDE ONLY — never import in client components.
 *
 * Key exports:
 *   sendPushNotification()              — send to ONE user (all devices)
 *   sendPushNotificationToMultipleUsers() — send to MANY users at once
 */

import { getFirebaseAdminMessaging } from "@/lib/firebase/admin"
import { createAdminClient } from "@/lib/supabase/admin"
import type { NotificationPayload, MulticastResult, UserNotificationResult } from "./types"

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Fetch all active FCM tokens for a given Supabase user ID.
 * A user can have multiple devices (phone, desktop, tablet).
 */
async function getUserFCMTokens(userId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("user_notification_tokens")
    .select("fcm_token")
    .eq("user_id", userId)

  if (error || !data) {
    console.error("[FCM] Failed to fetch tokens for user:", userId, error)
    return []
  }

  return data.map((row) => row.fcm_token).filter(Boolean)
}

/**
 * Remove an invalid/expired FCM token from Supabase.
 * Called automatically when FCM reports a token as invalid.
 */
async function purgeInvalidToken(token: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from("user_notification_tokens")
    .delete()
    .eq("fcm_token", token)
}

// ── Primary public API ────────────────────────────────────────────────────────

/**
 * Send a push notification to a specific user on ALL their registered devices.
 *
 * Features:
 * - Automatic multicast (one user, many devices)
 * - Invalid token auto-cleanup
 * - Android high-priority delivery
 * - iOS APNs support
 * - Web push with badge + vibration
 * - Notification deduplication via `tag`
 *
 * @example
 * // Notify a driver about a new delivery
 * await sendPushNotification({
 *   userId: driverId,
 *   notification: {
 *     title: "New delivery available!",
 *     body: "A package needs collecting near you.",
 *     url: "/dashboard/driver",
 *     tag: "new-delivery",
 *   }
 * })
 */
async function sendPushNotificationRaw({
  userId,
  notification,
}: {
  userId: string
  notification: NotificationPayload
}): Promise<MulticastResult> {
  console.log(`[FCM] sendPushNotification → user=${userId} title="${notification.title}" tag=${notification.tag ?? "(none)"}`)

  const db=createAdminClient()
  const [u,d]=await Promise.all([
    db.from("users").select("service_push_enabled,marketing_push_opt_in").eq("id",userId).maybeSingle(),
    db.from("driver_profiles").select("notifications_enabled,delivery_alerts").eq("id",userId).maybeSingle()
  ])
  const promotion=notification.tag?.includes("marketing")||notification.tag?.includes("reengagement")
  const newJob=(notification.tag?.startsWith("new-delivery")||notification.tag?.startsWith("bfm-new"))
  if(u.error||d.error||!u.data||u.data.service_push_enabled===false||d.data?.notifications_enabled===false||(newJob&&d.data?.delivery_alerts===false)||(promotion&&!u.data.marketing_push_opt_in))return {successCount:0,failureCount:0,failedTokens:[]}
  const config=await db.from("surge_pricing_settings").select("notification_settings").eq("id",1).single()
  if(config.error)return {successCount:0,failureCount:0,failedTokens:[]}
  const template=Object.entries(config.data.notification_settings??{}).filter(([key])=>notification.tag===key||notification.tag?.startsWith(key+"-")).sort((a,b)=>b[0].length-a[0].length)[0]?.[1] as {enabled?:boolean;title?:string}|undefined
  if(template?.enabled===false)return {successCount:0,failureCount:0,failedTokens:[]}
  if(template?.title)notification={...notification,title:template.title}
  const tokens = await getUserFCMTokens(userId)

  if (tokens.length === 0) {
    console.log(`[FCM] No registered tokens for user ${userId} — skipping send`)
    return { successCount: 0, failureCount: 0, failedTokens: [] }
  }

  console.log(`[FCM] Sending to ${tokens.length} token(s) for user ${userId}`)

  const messaging = getFirebaseAdminMessaging()
  const failedTokens: string[] = []

  try {
    // sendEachForMulticast gives us per-token results for clean error handling
    const response = await messaging.sendEachForMulticast({
      tokens,

      // ── Top-level notification ─────────────────────────────────────────────
      // REQUIRED for Chrome on Android to wake the device when the browser is
      // fully closed. Data-only messages are silently dropped on Android in
      // that state. The FCM SW's onBackgroundMessage handler is solely
      // responsible for calling showNotification() — registering the handler
      // disables Firebase's automatic display, so there is NO duplicate.
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.image,
      },

      // ── Web Push (Chrome, Edge, Firefox on desktop/Android) ──────────────
      webpush: {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: notification.icon ?? "/icons/icon-192.png",
          badge: "/icons/icon-72.png",   // Monochrome badge icon in status bar
          image: notification.image,
          tag: notification.tag ?? "go-drop",
          renotify: true,                // Re-alert even if same tag still showing
          requireInteraction: false,     // Auto-dismiss after ~4 s
          vibrate: [200, 100, 200],
          timestamp: Date.now(),
        },
        fcmOptions: {
          link: notification.url ?? "/", // URL opened on notification click
        },
        headers: {
          Urgency: "high",               // Deliver immediately, even on battery saver
          TTL: "86400",                  // Keep in FCM queue for 24 h if device offline
        },
      },

      // ── Android (FCM data + notification channel) ─────────────────────────
      android: {
        priority: "high",               // Wake the device even in Doze mode
        notification: {
          title: notification.title,
          body: notification.body,
          icon: notification.icon ?? "/icons/icon-192.png",
          sound: "default",
          channelId: "go-drop-notifications",
          tag: notification.tag,
          clickAction: notification.url ?? "/",
        },
        fcmOptions: {
          analyticsLabel: notification.tag ?? "push",
        },
      },

      // ── Apple (APNs via FCM) ──────────────────────────────────────────────
      apns: {
        headers: {
          "apns-priority": "10",        // Immediate delivery
          "apns-push-type": "alert",
        },
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body,
            },
            sound: "default",
            badge: 1,
            "content-available": 1,
          },
        },
      },

      // ── Custom data payload (available in service worker) ─────────────────
      // All values MUST be strings (FCM spec).
      data: {
        url: notification.url ?? "/",
        tag: notification.tag ?? "go-drop",
        title: notification.title,
        body: notification.body,
        ...(notification.image ? { image: notification.image } : {}),
        ...(notification.data ?? {}),
      },
    })

    // ── Process per-token results ─────────────────────────────────────────────
    for (let i = 0; i < response.responses.length; i++) {
      const result = response.responses[i]
      if (!result.success) {
        const code = result.error?.code ?? ""
        const token = tokens[i]

        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token" ||
          code === "messaging/mismatched-credential"
        ) {
          // Token is stale — purge from Supabase so we don't retry it
          console.log(`[FCM] Purging stale token: ${token.slice(0, 20)}…`)
          await purgeInvalidToken(token)
        } else {
          console.error(`[FCM] Send failure for token ${token.slice(0, 20)}…: ${code}`)
        }

        failedTokens.push(token)
      }
    }

    console.log(
      `[FCM] Delivered to ${response.successCount}/${tokens.length} device(s) for user ${userId}`
    )

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      failedTokens,
    }
  } catch (error) {
    console.error("[FCM] Multicast error:", error)
    return { successCount: 0, failureCount: tokens.length, failedTokens: tokens }
  }
}

/**
 * Send a push notification to multiple users in parallel.
 *
 * @example
 * // Notify all available drivers about a new order
 * await sendPushNotificationToMultipleUsers({
 *   userIds: onlineDriverIds,
 *   notification: {
 *     title: "New delivery request!",
 *     body: "Open the app to accept.",
 *     url: "/dashboard/driver",
 *     tag: "new-delivery",
 *   }
 * })
 */
export async function sendPushNotificationToMultipleUsers({
  userIds,
  notification,
}: {
  userIds: string[]
  notification: NotificationPayload
}): Promise<UserNotificationResult[]> {
  if (userIds.length === 0) return []

  const results = await Promise.allSettled(
    userIds.map(async (userId) => ({
      userId,
      result: await sendPushNotification({ userId, notification }),
    }))
  )

  return results
    .filter(
      (r): r is PromiseFulfilledResult<UserNotificationResult> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value)
}

export async function sendPushNotification(input:{userId:string;notification:NotificationPayload}):Promise<MulticastResult>{
 try{const result=await sendPushNotificationRaw(input);if(result.failureCount>0){await recordDispatchFailure('push',input.userId,{notification:input.notification},input.notification.tag);await recordHealth('push',false,'Some notification deliveries failed')}else if(result.successCount>0)await recordHealth('push',true,'Push provider accepted delivery');return result}
 catch{await recordDispatchFailure('push',input.userId,{notification:input.notification},input.notification.tag);await recordHealth('push',false,'Push provider unavailable');return{successCount:0,failureCount:1,failedTokens:[]}}
}
export async function retryPushDelivery(input:{userId:string;notification:NotificationPayload}){return sendPushNotificationRaw(input)}
