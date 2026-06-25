/**
 * lib/notifications/types.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared TypeScript types for the push notification system.
 */

// ── Notification payload ──────────────────────────────────────────────────────

/** The content of a push notification. */
export interface NotificationPayload {
  /** Main heading shown in the notification. */
  title: string
  /** Supporting text beneath the title. */
  body: string
  /** Icon URL (defaults to /icons/icon-192.png). */
  icon?: string
  /** Large image URL shown in expanded notifications. */
  image?: string
  /**
   * URL to open when the notification is clicked.
   * Defaults to "/" if omitted.
   */
  url?: string
  /**
   * Deduplication key — replaces an existing notification with the same tag
   * instead of stacking a new one. Useful for status-update notifications.
   */
  tag?: string
  /**
   * Arbitrary string key-value pairs forwarded to the service worker.
   * Values MUST be strings (FCM data payload requirement).
   */
  data?: Record<string, string>
}

// ── Token storage ─────────────────────────────────────────────────────────────

/** Row shape for the user_notification_tokens Supabase table. */
export interface FCMTokenRow {
  id: string
  user_id: string
  fcm_token: string
  device_type: "web" | "mobile" | "desktop"
  created_at: string
  updated_at: string
}

// ── Send results ──────────────────────────────────────────────────────────────

/** Result returned by sendPushNotification / sendPushNotificationToMultipleUsers. */
export interface MulticastResult {
  /** Number of devices that received the notification successfully. */
  successCount: number
  /** Number of devices that failed (invalid token, etc.). */
  failureCount: number
  /** Tokens that failed, already removed from Supabase. */
  failedTokens: string[]
}

/** Per-user result when notifying multiple users at once. */
export interface UserNotificationResult {
  userId: string
  result: MulticastResult
}

// ── Notification events ───────────────────────────────────────────────────────

/** Well-known notification tags used across the app to deduplicate toasts. */
export const NotificationTag = {
  NEW_DELIVERY: "new-delivery",
  DELIVERY_ACCEPTED: "delivery-accepted",
  DELIVERY_COLLECTED: "delivery-collected",
  DELIVERY_IN_TRANSIT: "delivery-in-transit",
  DELIVERY_DELIVERED: "delivery-delivered",
  DELIVERY_CANCELLED: "delivery-cancelled",
  DRIVER_APPROVED: "driver-approved",
  SYSTEM: "go-drop-system",
} as const

export type NotificationTagValue = (typeof NotificationTag)[keyof typeof NotificationTag]
