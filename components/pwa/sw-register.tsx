/**
 * components/pwa/sw-register.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The FCM service worker (/firebase-messaging-sw.js) is registered at scope "/"
 * by use-push-notifications.ts and now handles both PWA caching and FCM push
 * messages. A separate sw.js at the same scope would conflict, so this component
 * is intentionally a no-op.
 */
"use client"

export function SWRegister() {
  return null
}
