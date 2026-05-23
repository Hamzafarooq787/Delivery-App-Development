/**
 * Location Service Worker
 *
 * Runs independently of the main page thread.
 * Receives the driver's last known position via postMessage and re-broadcasts
 * it to the server every 5 seconds via fetch — even when the main page JS is
 * suspended (app switch on Android Chrome gives ~30s of SW lifetime per fetch).
 *
 * This is a best-effort relay; it cannot obtain new GPS positions (the
 * Geolocation API is not available in Service Workers), but it keeps the
 * last known position alive on the server while the driver briefly leaves the app.
 */

'use strict';

let lastPayload = null;
let relayActive = false;
let relayTimer  = null;

// ── Message handler ──────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'LOCATION':
      // Main page sends fresh GPS — store it
      lastPayload = payload;
      break;

    case 'START':
      if (!relayActive) {
        relayActive = true;
        scheduleRelay();
      }
      break;

    case 'STOP':
      relayActive = false;
      if (relayTimer) { clearTimeout(relayTimer); relayTimer = null; }
      lastPayload = null;
      break;
  }
});

// ── Relay loop ───────────────────────────────────────────────────────────────
// Each fetch keeps the SW alive for another ~30 s (Chrome on Android).
// The recursive setTimeout restarts immediately after each fetch completes.
function scheduleRelay() {
  if (!relayActive) return;
  relayTimer = setTimeout(async () => {
    if (lastPayload && relayActive) {
      try {
        await fetch('/api/sw-location', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(lastPayload),
          keepalive: true,          // request survives page unload / suspension
        });
      } catch {
        // Network unavailable — silent, will retry next cycle
      }
    }
    scheduleRelay(); // chain next cycle
  }, 5000);
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
