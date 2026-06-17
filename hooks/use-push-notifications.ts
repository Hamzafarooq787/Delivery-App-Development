/**
 * hooks/use-push-notifications.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that manages the full push notification lifecycle:
 *   1. Checks browser support for the Push API
 *   2. Requests / reads the current notification permission
 *   3. Registers the FCM service worker
 *   4. Generates a Firebase Cloud Messaging device token
 *   5. Saves the token to Supabase via /api/notifications/token
 *   6. Listens for foreground messages and shows Sonner toasts
 *   7. Auto-refreshes the token when the user logs in
 *
 * Usage:
 *   const { permission, requestPermission, isSupported } =
 *     usePushNotifications({ userId: user?.id })
 */
"use client"

import { useState, useEffect, useCallback, useRef, createElement } from "react"
import { getToken, onMessage } from "firebase/messaging"
import { getFirebaseMessaging } from "@/lib/firebase/client"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

export type PushPermissionState = "default" | "granted" | "denied"

export interface UsePushNotificationsOptions {
  /** Supabase user ID — required to save the token to the correct row. */
  userId?: string | null
  /**
   * When true, automatically requests permission 3 seconds after the
   * user ID becomes available (first-time login experience).
   * @default false
   */
  autoRequest?: boolean
}

export interface UsePushNotificationsReturn {
  /** Current browser notification permission state. */
  permission: PushPermissionState
  /** Whether the current browser supports the Push / Notifications APIs. */
  isSupported: boolean
  /** True while the permission dialog or token generation is in progress. */
  isLoading: boolean
  /** The active FCM token for this device, or null if not yet obtained. */
  token: string | null
  /**
   * Prompt the user to grant notification permission, register the FCM
   * service worker, and save the token. Returns true on success.
   */
  requestPermission: () => Promise<boolean>
  /**
   * Unsubscribes from foreground messages and clears the token in state.
   * Does NOT revoke browser permission (that must be done in browser settings).
   */
  unsubscribe: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** VAPID public key — from Firebase Console → Project Settings → Cloud Messaging */
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!

/** Scope under which the FCM service worker is registered.
 *  Must NOT conflict with the existing caching SW at scope "/". */
const FCM_SW_SCOPE = "/firebase-messaging-sw.js/"

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Returns when the given ServiceWorkerRegistration has an active worker.
 * Resolves immediately if already active, otherwise waits for "activated" state.
 */
function waitForSWActive(reg: ServiceWorkerRegistration): Promise<void> {
  return new Promise((resolve) => {
    if (reg.active) {
      resolve()
      return
    }
    // The SW might be installing → waiting → activating
    const worker = reg.installing ?? reg.waiting
    if (!worker) {
      resolve()
      return
    }
    worker.addEventListener("statechange", function handler() {
      if ((this as ServiceWorker).state === "activated") {
        worker.removeEventListener("statechange", handler)
        resolve()
      }
    })
  })
}

// ── Hook implementation ───────────────────────────────────────────────────────

export function usePushNotifications({
  userId,
  autoRequest = false,
}: UsePushNotificationsOptions = {}): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<PushPermissionState>("default")
  const [isSupported, setIsSupported] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  // Ref to unsubscribe from foreground message listener
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // ── Initialise: check support and read existing permission ────────────────
  useEffect(() => {
    if (typeof window === "undefined") return

    const supported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window

    setIsSupported(supported)

    if (supported) {
      setPermission(Notification.permission as PushPermissionState)
    }
  }, [])

  // ── Register FCM service worker and obtain a device token ─────────────────
  const getFCMToken = useCallback(async (): Promise<string | null> => {
    if (!VAPID_KEY) {
      console.error("[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set")
      return null
    }

    try {
      const messaging = getFirebaseMessaging()
      if (!messaging) return null

      // Register the dedicated FCM service worker.
      // We use a sub-scope so it doesn't conflict with sw.js at scope "/".
      const swReg = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        {
          scope: FCM_SW_SCOPE,
          updateViaCache: "none", // Always check for a new version
        }
      )

      // Wait for the SW to reach "activated" state before calling getToken().
      // getToken() calls pushManager.subscribe() internally — this fails if
      // the SW is still in "installing" or "waiting" state.
      await waitForSWActive(swReg)

      // Obtain (or refresh) the FCM token linked to this registration
      const fcmToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg,
      })

      return fcmToken || null
    } catch (error) {
      console.error("[FCM] Failed to get device token:", error)
      return null
    }
  }, [])

  // ── Persist the FCM token to Supabase ─────────────────────────────────────
  const saveToken = useCallback(
    async (fcmToken: string): Promise<void> => {
      if (!userId) return

      try {
        const deviceType = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        )
          ? "mobile"
          : "desktop"

        const res = await fetch("/api/notifications/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: fcmToken, deviceType }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          console.error("[FCM] Token save failed:", err)
        } else {
          console.log("[FCM] Token saved for user:", userId)
        }
      } catch (error) {
        console.error("[FCM] Token save error:", error)
      }
    },
    [userId]
  )

  // ── Foreground message listener → Sonner toast ────────────────────────────
  const setupForegroundListener = useCallback(() => {
    const messaging = getFirebaseMessaging()
    if (!messaging) return

    // Tear down any previous listener first
    unsubscribeRef.current?.()

    const unsub = onMessage(messaging, (payload) => {
      if (!payload) return

      const { notification, data } = payload

      // notification field is present (we include it in the FCM payload for
      // Android wake support). Fall back to data fields as a safety net.
      const title = notification?.title ?? data?.title ?? "Kinetic Void"
      const body  = notification?.body  ?? data?.body  ?? ""
      const url   = data?.url ?? "/"
      const image = notification?.image ?? data?.image

      const actionEl =
        url !== "/"
          ? createElement(
              "button",
              {
                style: { fontSize: 12, fontWeight: 600, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 4 },
                onClick: () => { window.location.href = url },
              },
              "View"
            )
          : null

      if (image) {
        // Render a rich toast with the notification image
        toast.custom(
          () =>
            createElement(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: 4, width: "100%" } },
              createElement("img", {
                src: image,
                alt: "",
                style: { width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 6 },
              }),
              createElement("p", { style: { fontWeight: 600, fontSize: 13, margin: 0 } }, title),
              body ? createElement("p", { style: { fontSize: 12, opacity: 0.75, margin: 0 } }, body) : null,
              actionEl,
            ),
          { duration: 7000 }
        )
      } else {
        toast(title, {
          description: body,
          duration: 7000,
          action:
            url !== "/"
              ? { label: "View", onClick: () => { window.location.href = url } }
              : undefined,
        })
      }
    })

    unsubscribeRef.current = unsub
  }, [])

  // ── Public: request permission + generate + save token ────────────────────
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error("Push notifications are not supported in this browser.")
      return false
    }

    setIsLoading(true)

    try {
      const result = await Notification.requestPermission()
      setPermission(result as PushPermissionState)

      if (result === "granted") {
        const fcmToken = await getFCMToken()
        if (fcmToken) {
          setToken(fcmToken)
          await saveToken(fcmToken)
          setupForegroundListener()
          return true
        }
      }

      return false
    } catch (error) {
      console.error("[FCM] requestPermission error:", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, getFCMToken, saveToken, setupForegroundListener])

  // ── Auto-init when permission already granted (returning user) ────────────
  useEffect(() => {
    if (!userId || !isSupported) return
    if (Notification.permission !== "granted") return

    let cancelled = false

    const init = async () => {
      const fcmToken = await getFCMToken()
      if (cancelled || !fcmToken) return
      setToken(fcmToken)
      await saveToken(fcmToken)
      setupForegroundListener()
    }

    init()

    return () => {
      cancelled = true
      // Clean up foreground listener on unmount / userId change
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
  }, [userId, isSupported, getFCMToken, saveToken, setupForegroundListener])

  // ── Auto-request (optional, delayed 3 s after login) ─────────────────────
  useEffect(() => {
    if (!autoRequest || !userId || !isSupported) return
    if (Notification.permission !== "default") return // Already decided

    const timer = setTimeout(() => {
      requestPermission()
    }, 3000)

    return () => clearTimeout(timer)
  }, [autoRequest, userId, isSupported, requestPermission])

  // ── Unsubscribe helper ────────────────────────────────────────────────────
  const unsubscribe = useCallback(() => {
    unsubscribeRef.current?.()
    unsubscribeRef.current = null
    setToken(null)
  }, [])

  return { permission, isSupported, isLoading, token, requestPermission, unsubscribe }
}
