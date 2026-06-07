/**
 * components/pwa/sw-register.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Registers both service workers on mount:
 *
 *   /sw.js                    — caching / offline support (scope: /)
 *   /firebase-messaging-sw.js — FCM background push notifications
 *                               (scope: /firebase-messaging-sw.js/ to avoid
 *                                conflicting with the caching SW)
 *
 * The FCM SW is served dynamically by a Next.js route handler that injects
 * Firebase config from environment variables at request time.
 */
"use client"

import { useEffect } from "react"

export function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    // ── 1. Main caching service worker ───────────────────────────────────────
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => console.log("[SW] Caching service worker registered"))
      .catch((err) => console.warn("[SW] Caching SW registration failed:", err))

    // ── 2. FCM push notification service worker ───────────────────────────────
    // Registered at a sub-scope so it does NOT override the caching SW at "/".
    // The FCM token is linked to this specific registration in use-push-notifications.ts.
    navigator.serviceWorker
      .register("/firebase-messaging-sw.js", {
        scope: "/firebase-messaging-sw.js/",
        updateViaCache: "none", // Always check for updates (config may change)
      })
      .then(() => console.log("[FCM-SW] Push notification service worker registered"))
      .catch((err) => console.warn("[FCM-SW] Registration failed:", err))
  }, [])

  return null
}
