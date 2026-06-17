/**
 * components/pwa/sw-register.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Registers the main caching service worker on mount.
 *
 * NOTE: The FCM push notification SW (/firebase-messaging-sw.js) is registered
 * inside use-push-notifications.ts when the user grants permission, so that it
 * is linked to the correct ServiceWorkerRegistration for getToken(). Registering
 * it here as well would create a duplicate that is not used by FCM.
 */
"use client"

import { useEffect } from "react"

export function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => console.log("[SW] Caching service worker registered"))
      .catch((err) => console.warn("[SW] Caching SW registration failed:", err))
  }, [])

  return null
}
