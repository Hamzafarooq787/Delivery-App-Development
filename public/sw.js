/**
 * Kinetic Void — Combined Service Worker
 *
 * Handles three responsibilities in a single registration (scope: /):
 *
 *  1. Offline caching — network-first for navigations, cache-first for assets
 *  2. Location relay  — receives the driver's last GPS fix via postMessage and
 *                       re-sends it to /api/sw-location every 5 s while active
 *                       (keeps the server updated when the main tab is backgrounded)
 *  3. Push notifications — receives push events from the app server and shows
 *                          native OS notifications with a tap-to-open action
 */

'use strict'

// ─────────────────────────────────────────────────────────────────────────────
// 1. OFFLINE CACHING
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_NAME      = 'kv-cache-v2'
const OFFLINE_URL     = '/offline'
const PRECACHE_ASSETS = [
  '/',
  '/login',
  '/signup',
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_ASSETS).catch(() => {})
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.includes('supabase')
  ) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()))
          }
          return res
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    )
    return
  }

  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf)$/)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()))
            return res
          })
      )
    )
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. LOCATION RELAY  (driver background GPS keepalive)
// ─────────────────────────────────────────────────────────────────────────────

let _lastPayload = null
let _relayActive = false
let _relayTimer  = null

function _scheduleRelay() {
  if (!_relayActive) return
  _relayTimer = setTimeout(async () => {
    if (_lastPayload && _relayActive) {
      try {
        await fetch('/api/sw-location', {
          method:    'POST',
          headers:   { 'Content-Type': 'application/json' },
          body:      JSON.stringify(_lastPayload),
          keepalive: true,
        })
      } catch {}
    }
    _scheduleRelay()
  }, 5000)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PUSH NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data?.json() ?? {} } catch {}

  const title   = data.title   || 'New Job Alert'
  const body    = data.body    || 'A new delivery is available near you.'
  const url     = data.url     || '/dashboard/driver/jobs/available'
  const tag     = data.tag     || 'new-job'
  const icon    = data.icon    || '/icons/icon-192.png'
  const badge   = data.badge   || '/icons/icon-72.png'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      renotify: true,           // re-alert even if same tag is already showing
      requireInteraction: false, // auto-dismiss on Android after a few seconds
      data: { url },
      vibrate: [200, 100, 200], // short-long-short vibration pattern
      actions: [
        { action: 'view', title: '👀 View Job' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return

  const targetUrl = event.notification.data?.url || '/dashboard/driver/jobs/available'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open in a tab, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) client.navigate(targetUrl)
          return
        }
      }
      // Otherwise open a new tab
      return self.clients.openWindow(targetUrl)
    })
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. MESSAGE HANDLER  (postMessage from main thread)
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {}

  switch (type) {
    // Location relay messages (from DriverLocationBroadcaster)
    case 'LOCATION':
      _lastPayload = payload
      break

    case 'START':
      if (!_relayActive) {
        _relayActive = true
        _scheduleRelay()
      }
      break

    case 'STOP':
      _relayActive = false
      if (_relayTimer) { clearTimeout(_relayTimer); _relayTimer = null }
      _lastPayload = null
      break
  }
})
