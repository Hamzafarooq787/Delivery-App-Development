/**
 * components/pwa/sw-register.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Eagerly registers the combined FCM + PWA service worker at scope "/" so that
 * offline caching works for ALL users regardless of push-notification permission.
 * Users who deny or never see the notification prompt still get PWA caching.
 *
 * When the user later grants permission, use-push-notifications.ts calls
 * register() again with the same script + scope. The browser returns the same
 * existing ServiceWorkerRegistration, which getToken() then uses for FCM.
 */
"use client"

import { useEffect } from "react"

export function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/firebase-messaging-sw.js", { scope: "/", updateViaCache: "none" })
      .then(() => console.log("[SW] FCM/PWA service worker registered"))
      .catch((err) => console.warn("[SW] FCM/PWA SW registration failed:", err))
  }, [])

  return null
}
