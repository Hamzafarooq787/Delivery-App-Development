/**
 * hooks/use-push-notifications.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that manages the full push notification lifecycle:
 *   1. Checks browser support for the Push API
 *   2. Requests / reads the current notification permission
 *   3. Registers the FCM service worker at scope "/" (root)
 *   4. Generates a Firebase Cloud Messaging device token
 *   5. Saves the token to Supabase via /api/notifications/token
 *   6. Listens for foreground messages via Firebase onMessage() → Sonner toast
 *   7. Auto-refreshes the token when the user logs in
 *
 * Service worker architecture:
 *   The FCM SW is registered at scope "/" so it controls all pages. This lets
 *   Firebase SDK distinguish foreground (visible page) from background (hidden
 *   or no page), routing accordingly:
 *     visible page → onMessage() here → in-app Sonner toast (no OS notification)
 *     hidden/closed → onBackgroundMessage() in SW → OS notification
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
  userId?: string | null
  autoRequest?: boolean
}

export interface UsePushNotificationsReturn {
  permission: PushPermissionState
  isSupported: boolean
  isLoading: boolean
  token: string | null
  requestPermission: () => Promise<boolean>
  unsubscribe: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Resolves when the given ServiceWorkerRegistration has an active worker.
 * Handles the race where register() returns before the browser sets reg.installing.
 */
function waitForSWActive(reg: ServiceWorkerRegistration): Promise<void> {
  return new Promise((resolve) => {
    if (reg.active) { resolve(); return }

    const trackWorker = (worker: ServiceWorker) => {
      if (worker.state === "activated") { resolve(); return }
      worker.addEventListener("statechange", function handler() {
        if ((this as ServiceWorker).state === "activated") {
          worker.removeEventListener("statechange", handler)
          resolve()
        }
      })
    }

    const worker = reg.installing ?? reg.waiting
    if (worker) { trackWorker(worker); return }

    // Race condition: register() returned before the browser set reg.installing.
    const onUpdateFound = () => {
      reg.removeEventListener("updatefound", onUpdateFound)
      const installing = reg.installing
      if (installing) { trackWorker(installing); return }
      resolve()
    }
    reg.addEventListener("updatefound", onUpdateFound)

    // Safety net: don't hang if SW is already activated when we attach the listener.
    setTimeout(() => {
      reg.removeEventListener("updatefound", onUpdateFound)
      resolve()
    }, 10_000)
  })
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePushNotifications({
  userId,
  autoRequest = false,
}: UsePushNotificationsOptions = {}): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<PushPermissionState>("default")
  const [isSupported, setIsSupported] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  const unsubscribeRef = useRef<(() => void) | null>(null)

  // ── Browser support + initial permission read ─────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return

    const supported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window

    setIsSupported(supported)
    if (supported) setPermission(Notification.permission as PushPermissionState)

    // Re-read permission when the user switches back to the tab
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && "Notification" in window) {
        setPermission(Notification.permission as PushPermissionState)
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [])

  // ── Register FCM SW at root scope + get FCM token ─────────────────────────
  const getFCMToken = useCallback(async (): Promise<string | null> => {
    if (!VAPID_KEY) {
      console.error("[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set")
      return null
    }

    try {
      const messaging = getFirebaseMessaging()
      if (!messaging) return null

      // Migrate: unregister the old narrow-scope FCM SW if it still exists.
      // The old scope "/firebase-messaging-sw.js/" had no controlled clients,
      // so Firebase always took the background path and showed OS notifications
      // while the app was open, triggering Chrome's notification quiet mode.
      //
      // Must use getRegistrations() + scope check rather than getRegistration(url),
      // because getRegistration(url) finds the SW whose scope CONTAINS the given
      // URL — after migration, the new root SW at scope "/" also matches the URL
      // "/firebase-messaging-sw.js/" and would be incorrectly unregistered.
      try {
        const allRegs = await navigator.serviceWorker.getRegistrations()
        const oldReg = allRegs.find((r) => r.scope.endsWith("/firebase-messaging-sw.js/"))
        if (oldReg) {
          await oldReg.unregister()
          console.log("[FCM] Migrated: unregistered old FCM SW at /firebase-messaging-sw.js/ scope")
        }
      } catch {}

      // Register (or update) the FCM SW at root scope.
      // Registered at scope "/" so it controls all pages — Firebase SDK can
      // then distinguish foreground (onMessage) from background (onBackgroundMessage).
      // skipWaiting() in the SW ensures it takes over immediately from sw.js.
      const swReg = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/", updateViaCache: "none" }
      )

      await waitForSWActive(swReg)

      // Diagnostics — visible in DevTools console
      console.log("[FCM] Controller SW:", navigator.serviceWorker.controller?.scriptURL)
      console.log("[FCM] Ready SW:", swReg.active?.scriptURL)
      console.log("[FCM] Registration Scope:", swReg.scope)

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

  // ── Save FCM token to Supabase ────────────────────────────────────────────
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
  // Firebase SDK routes foreground pushes (visible controlled page) to onMessage().
  // This only fires when the driver has the app open — no OS notification is shown.
  const setupForegroundListener = useCallback(() => {
    const messaging = getFirebaseMessaging()
    if (!messaging) return

    unsubscribeRef.current?.()

    const unsub = onMessage(messaging, (payload) => {
      if (!payload) return

      const { notification, data } = payload
      const title = notification?.title ?? data?.title ?? "Go Drop"
      const body  = notification?.body  ?? data?.body  ?? ""
      const url   = data?.url ?? "/"
      const image = notification?.image ?? data?.image

      console.log("[FCM] Foreground message received:", title)

      const actionEl =
        url && url !== "/"
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
            url && url !== "/"
              ? { label: "View", onClick: () => { window.location.href = url } }
              : undefined,
        })
      }
    })

    unsubscribeRef.current = unsub
  }, [])

  // ── Public: request permission → register SW → save token ─────────────────
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
        // Register onMessage listener immediately so the very first push
        // that arrives (even before token save completes) shows a toast.
        setupForegroundListener()
        const fcmToken = await getFCMToken()
        if (fcmToken) {
          setToken(fcmToken)
          await saveToken(fcmToken)
        }
        return true
      }

      return false
    } catch (error) {
      console.error("[FCM] requestPermission error:", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, getFCMToken, saveToken, setupForegroundListener])

  // ── Auto-init for returning users (permission already granted) ────────────
  useEffect(() => {
    if (!userId || !isSupported) return
    if (Notification.permission !== "granted") return

    // Register onMessage listener immediately — this must not wait for the
    // token fetch so that pushes arriving while the user is on ANY page
    // (including the debug endpoint) are caught and shown as a toast.
    setupForegroundListener()

    let cancelled = false

    const init = async () => {
      const fcmToken = await getFCMToken()
      if (cancelled || !fcmToken) return
      setToken(fcmToken)
      await saveToken(fcmToken)
    }

    init()

    return () => {
      cancelled = true
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
  }, [userId, isSupported, getFCMToken, saveToken, setupForegroundListener])

  // ── Auto-request (optional, 3 s after login) ──────────────────────────────
  useEffect(() => {
    if (!autoRequest || !userId || !isSupported) return
    if (Notification.permission !== "default") return

    const timer = setTimeout(() => { requestPermission() }, 3000)
    return () => clearTimeout(timer)
  }, [autoRequest, userId, isSupported, requestPermission])

  // ── Unsubscribe ───────────────────────────────────────────────────────────
  const unsubscribe = useCallback(() => {
    unsubscribeRef.current?.()
    unsubscribeRef.current = null
    setToken(null)
  }, [])

  return { permission, isSupported, isLoading, token, requestPermission, unsubscribe }
}
