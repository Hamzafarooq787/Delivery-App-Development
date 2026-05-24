"use client"

import { useEffect, useRef, useState } from "react"
import { updateMyLocation, clearMyLocation } from "@/app/actions/tracking"

type Props = {
  deliveryId?: string | null
  disabled?: boolean
  intervalMs?: number
  showStatus?: boolean
  className?: string
}

type Status = "idle" | "requesting" | "broadcasting" | "denied" | "unsupported" | "error"

// ─────────────────────────────────────────────────────────────────────────────
// Keepalive technique 1: Silent Web Audio oscillator
// Playing a near-inaudible tone keeps the browser audio session active.
// The OS treats an active audio session as foreground and does NOT fully suspend
// JS — same approach as NoSleep.js. Most effective on Chrome for Android.
// ─────────────────────────────────────────────────────────────────────────────
async function startAudioKeepalive(): Promise<() => void> {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return () => {}
    const ctx = new AudioCtx()
    if (ctx.state === "suspended") await ctx.resume()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value  = 0.001  // effectively inaudible
    osc.type         = "sine"
    osc.frequency.value = 1   // 1 Hz — sub-audible
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    return () => { try { osc.stop(); ctx.close() } catch {} }
  } catch {
    return () => {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Keepalive technique 2: Silent canvas video loop
// Pipes a 2×2 canvas (1 fps) into a muted <video> element.
// iOS Safari prioritises active video sessions and keeps the tab alive longer
// than audio alone. Combined with audio, covers both Android and iOS.
// ─────────────────────────────────────────────────────────────────────────────
function startVideoKeepalive(): () => void {
  try {
    const canvas = document.createElement("canvas")
    canvas.width = 2; canvas.height = 2
    const ctx = canvas.getContext("2d")
    if (!ctx) return () => {}

    let tick = 0
    // Alternate micro-colors so the canvas always generates real frames
    const frameTimer = setInterval(() => {
      ctx.fillStyle = tick++ % 2 === 0 ? "#000001" : "#000000"
      ctx.fillRect(0, 0, 2, 2)
    }, 1000)

    const stream = (canvas as any).captureStream?.(1)
    if (!stream) { clearInterval(frameTimer); return () => {} }

    const video = document.createElement("video")
    video.srcObject  = stream
    video.muted      = true
    video.loop       = true
    video.playsInline = true
    video.setAttribute("playsinline", "")
    video.play().catch(() => {})

    return () => {
      clearInterval(frameTimer)
      video.pause()
      video.srcObject = null
    }
  } catch {
    return () => {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Keepalive technique 3: Service Worker relay
// Registers /sw-location.js and starts it sending the last known position to
// /api/sw-location every 5 s via fetch — independently of the main page thread.
// When the main page JS is frozen (app switch), the SW keeps running for ~30 s
// on Chrome for Android (each successful fetch resets the 30 s SW lifetime timer).
// ─────────────────────────────────────────────────────────────────────────────
async function registerLocationSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null
  try {
    // Use unified sw.js — handles both location relay and push notifications
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
    return reg
  } catch {
    return null
  }
}

function postToSW(reg: ServiceWorkerRegistration | null, msg: object) {
  try {
    const sw = reg?.active ?? reg?.installing ?? reg?.waiting
    sw?.postMessage(msg)
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
export function DriverLocationBroadcaster({
  deliveryId = null,
  disabled = false,
  intervalMs = 3000,
  showStatus = true,
  className,
}: Props) {
  const [status,        setStatus]        = useState<Status>("idle")
  const [lastPing,      setLastPing]      = useState<number | null>(null)
  const [wakeLockDenied, setWakeLockDenied] = useState(false)
  const [isHidden,      setIsHidden]      = useState(false)

  const lastSentRef   = useRef<number>(0)
  const watchIdRef    = useRef<number | null>(null)
  const inFlightRef   = useRef<boolean>(false)
  const wakeLockRef   = useRef<WakeLockSentinel | null>(null)
  const fallbackRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopAudioRef  = useRef<(() => void) | null>(null)
  const stopVideoRef  = useRef<(() => void) | null>(null)
  const swRegRef      = useRef<ServiceWorkerRegistration | null>(null)
  // Last raw position — sent instantly on reconnect before fresh GPS arrives
  const lastPosRef    = useRef<GeolocationPosition | null>(null)

  // ── Wake lock ──────────────────────────────────────────────────────────────
  async function acquireWakeLock() {
    if (!("wakeLock" in navigator)) return
    try {
      wakeLockRef.current = await (navigator as any).wakeLock.request("screen")
      wakeLockRef.current.addEventListener("release", () => { wakeLockRef.current = null })
    } catch { setWakeLockDenied(true) }
  }
  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }

  // ── Start all keepalives ───────────────────────────────────────────────────
  async function startKeepalives() {
    acquireWakeLock()
    stopAudioRef.current = await startAudioKeepalive()
    stopVideoRef.current = startVideoKeepalive()
    if (!swRegRef.current) {
      swRegRef.current = await registerLocationSW()
    }
    postToSW(swRegRef.current, { type: "START" })
  }

  function stopKeepalives() {
    releaseWakeLock()
    stopAudioRef.current?.(); stopAudioRef.current = null
    stopVideoRef.current?.(); stopVideoRef.current = null
    postToSW(swRegRef.current, { type: "STOP" })
  }

  // ── Geolocation watch ──────────────────────────────────────────────────────
  function startWatch(onPos: PositionCallback, onErr: PositionErrorCallback) {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    watchIdRef.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 500,
      timeout: 15000,
    })
  }

  function startFallback(onPos: PositionCallback) {
    if (fallbackRef.current) clearInterval(fallbackRef.current)
    fallbackRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(onPos, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      })
    }, intervalMs * 2)
  }

  function stopFallback() {
    if (fallbackRef.current) { clearInterval(fallbackRef.current); fallbackRef.current = null }
  }

  // ── Send position to server ────────────────────────────────────────────────
  function sendPosition(pos: GeolocationPosition, force = false) {
    const now = Date.now()
    if (inFlightRef.current) return
    if (!force && now - lastSentRef.current < intervalMs) return

    lastSentRef.current = now
    lastPosRef.current  = pos
    inFlightRef.current = true
    setStatus("broadcasting")

    const payload = {
      lat:         pos.coords.latitude,
      lng:         pos.coords.longitude,
      heading:     Number.isFinite(pos.coords.heading)  ? pos.coords.heading  : null,
      speed:       Number.isFinite(pos.coords.speed)    ? pos.coords.speed    : null,
      accuracy:    Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
      delivery_id: deliveryId,
    }

    // Also hand position to Service Worker so it can relay independently
    postToSW(swRegRef.current, { type: "LOCATION", payload })

    updateMyLocation(payload)
      .then((res) => { if (res?.error) setStatus("error"); else setLastPing(now) })
      .catch(() => setStatus("error"))
      .finally(() => { inFlightRef.current = false })
  }

  // ── Main effect ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (disabled) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      stopFallback()
      stopKeepalives()
      setStatus("idle")
      clearMyLocation().catch(() => {})
      return
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported"); return
    }

    setStatus("requesting")
    startKeepalives()

    const onPosition = (pos: GeolocationPosition) => sendPosition(pos)
    const onError    = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) setStatus("denied")
      else setStatus("error")
    }

    startWatch(onPosition, onError)
    startFallback(onPosition)

    // ── Foreground/reconnect events ────────────────────────────────────────
    // Every possible event that signals "driver is back" — fires instantly
    // so the customer never sees a gap longer than one GPS cycle.
    function handleForeground() {
      setIsHidden(false)
      if (lastPosRef.current) sendPosition(lastPosRef.current, true) // flush cached pos
      startWatch(onPosition, onError)   // browser may have paused watchPosition
      acquireWakeLock()                 // re-acquire — released on screen lock
      // Restart audio/video if stopped (iOS releases audio on background)
      if (!stopAudioRef.current) {
        startAudioKeepalive().then((s) => { stopAudioRef.current = s })
      }
      if (!stopVideoRef.current) {
        stopVideoRef.current = startVideoKeepalive()
      }
    }

    function handleHidden() { setIsHidden(true) }

    function onVisibility() {
      document.visibilityState === "visible" ? handleForeground() : handleHidden()
    }

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus",    handleForeground)
    window.addEventListener("online",   handleForeground)
    window.addEventListener("pageshow", handleForeground)
    // Android Chrome "resume" (fired when app comes back from background)
    document.addEventListener("resume", handleForeground)

    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus",    handleForeground)
      window.removeEventListener("online",   handleForeground)
      window.removeEventListener("pageshow", handleForeground)
      document.removeEventListener("resume", handleForeground)
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      stopFallback()
      stopKeepalives()
      clearMyLocation().catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, intervalMs, deliveryId])

  if (!showStatus) return null

  const cfg = (() => {
    switch (status) {
      case "broadcasting": return { color: "bg-green-400",    text: "Sharing location",          animate: true  }
      case "requesting":   return { color: "bg-yellow-400",   text: "Requesting GPS…",            animate: true  }
      case "denied":       return { color: "bg-[#ff6e84]",    text: "Location permission denied", animate: false }
      case "unsupported":  return { color: "bg-[#ff6e84]",    text: "GPS not supported",          animate: false }
      case "error":        return { color: "bg-amber-400",    text: "Location error — retrying",  animate: true  }
      default:             return { color: "bg-[#494847]",    text: "Location off",               animate: false }
    }
  })()

  const showScreenWarning = (wakeLockDenied || isHidden) && status === "broadcasting"

  return (
    <div className="space-y-1.5">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a1919] border border-[#494847]/30 ${className ?? ""}`}>
        <span className={`w-2 h-2 rounded-full ${cfg.color} ${cfg.animate ? "animate-pulse" : ""}`} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-white">{cfg.text}</span>
        {lastPing && status === "broadcasting" && (
          <span className="text-[10px] text-[#adaaaa] normal-case font-medium tracking-normal">
            · {new Date(lastPing).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        )}
      </div>

      {showScreenWarning && (
        <div className="flex items-start gap-2 bg-amber-400/10 border border-amber-400/30 rounded-xl px-3 py-2.5 max-w-sm">
          <span className="material-symbols-outlined text-amber-400 text-base shrink-0 mt-0.5"
                style={{ fontVariationSettings: "'FILL' 1" }}>
            screen_lock_portrait
          </span>
          <p className="text-[11px] text-amber-300 leading-relaxed font-medium">
            <span className="font-bold text-amber-400">Keep this screen open.</span>{" "}
            Locking your phone or switching apps pauses location sharing.
          </p>
        </div>
      )}
    </div>
  )
}
