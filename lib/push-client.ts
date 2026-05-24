/**
 * Client-side Web Push subscription management.
 *
 * Flow:
 *   1.  Register the unified service worker (sw.js)
 *   2.  Request notification permission (if not already granted)
 *   3.  Create a PushSubscription via PushManager.subscribe()
 *   4.  POST the subscription to /api/push/subscribe (saves in DB)
 *   5.  The server then knows where to send push events for this user
 */

const SW_PATH          = '/sw.js'
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

// Convert a VAPID public key (base64url) to a Uint8Array for the browser API
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

/** True if this browser environment supports Web Push. */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Current Notification permission status. */
export function getPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/**
 * Register sw.js, request notification permission, subscribe to Web Push,
 * and POST the subscription to the server.
 *
 * Returns the PushSubscription on success, null on failure.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
    return null
  }

  // 1. Request permission
  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') return null

  try {
    // 2. Register / retrieve the service worker
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' })
    await navigator.serviceWorker.ready

    // 3. Check for an existing subscription first
    const existing = await reg.pushManager.getSubscription()
    if (existing) {
      // Ensure it's saved in the DB (idempotent upsert on the server)
      await _saveSubscription(existing)
      return existing
    }

    // 4. Create a new subscription
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    // 5. Send to server
    await _saveSubscription(sub)
    return sub
  } catch (err) {
    console.error('[push] subscribe error:', err)
    return null
  }
}

/** Unsubscribe from push and remove from server. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH)
    if (!reg) return
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    await fetch('/api/push/unsubscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ endpoint: sub.endpoint }),
    })
    await sub.unsubscribe()
  } catch {}
}

async function _saveSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON()
  await fetch('/api/push/subscribe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      endpoint: json.endpoint,
      p256dh:   (json.keys as any)?.p256dh   ?? '',
      auth:     (json.keys as any)?.auth      ?? '',
      userAgent: navigator.userAgent,
    }),
  })
}
