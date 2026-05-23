"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { updateMyLocation, clearMyLocation } from "@/app/actions/tracking"

type Props = {
  deliveryId?: string | null
  disabled?: boolean
  intervalMs?: number
  showStatus?: boolean
  className?: string
}

type Status = "idle" | "requesting" | "broadcasting" | "denied" | "unsupported" | "error"

// ─── Silent audio keepalive ───────────────────────────────────────────────────
// Playing a near-silent (inaudible) tone holds the browser's audio session open.
// The OS treats an active audio session as foreground activity and does NOT fully
// suspend JavaScript — this is the same technique used by NoSleep.js.
// Works on Chrome/Android; partially effective on iOS Safari.
async function startSilentAudio(): Promise<() => void> {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return () => {}
    const ctx = new AudioCtx()
    // iOS starts AudioContext in "suspended" state — resume after user interaction
    if (ctx.state === "suspended") await ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value = 0.001   // effectively inaudible, but not 0 (some browsers skip 0-gain nodes)
    osc.type = "sine"
    osc.frequency.value = 1  // 1 Hz — completely sub-audible
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    return () => { try { osc.stop(); ctx.close() } catch {} }
  } catch {
    return () => {}
  }
}

export function DriverLocationBroadcaster({
  deliveryId = null,
  disabled = false,
  intervalMs = 4000,
  showStatus = true,
  className,
}: Props) {
  const [status, setStatus] = useState<Status>("idle")
  const [lastPing, setLastPing] = useState<number | null>(null)
  const [wakeLockDenied, setWakeLockDenied] = useState(false)
  const [isHidden, setIsHidden] = useState(false)

  const lastSentRef      = useRef<number>(0)
  const watchIdRef       = useRef<number | null>(null)
  const inFlightRef      = useRef<boolean>(false)
  const wakeLockRef      = useRef<WakeLockSentinel | null>(null)
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopAudioRef     = useRef<(() => void) | null>(null)
  // Cache of last known position — sent immediately on reconnect
  const lastPosRef       = useRef<GeolocationPosition | null>(null)

  // ── Wake lock ──────────────────────────────────────────────────────────────
  async function acquireWakeLock() {
    if (!("wakeLock" in navigator)) return
    try {
      wakeLockRef.current = await (navigator as any).wakeLock.request("screen")
      wakeLockRef.current.addEventListener("release", () => {
        wakeLockRef.current = null
      })
    } catch {
      setWakeLockDenied(true)
    }
  }

  function releaseWakeLock() {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {})
      wakeLockRef.current = null
    }
  }

  // ── Geolocation watch ──────────────────────────────────────────────────────
  function startWatch(onPos: PositionCallback, onErr: PositionErrorCallback) {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }
    watchIdRef.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 15000,
    })
  }

  function startFallbackInterval(onPos: PositionCallback) {
    if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current)
    fallbackTimerRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(onPos, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      })
    }, intervalMs * 2)
  }

  function stopFallbackInterval() {
    if (fallbackTimerRef.current) {
      clearInterval(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
  }

  // ── Send a position to the server ─────────────────────────────────────────
  function sendPosition(pos: GeolocationPosition, force = false) {
    const now = Date.now()
    if (inFlightRef.current) return
    if (!force && now - lastSentRef.current < intervalMs) return

    lastSentRef.current = now
    inFlightRef.current = true
    lastPosRef.current = pos
    setStatus("broadcasting")

    updateMyLocation({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
      speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
      accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
      delivery_id: deliveryId,
    })
      .then((res) => {
        if (res?.error) setStatus("error")
        else setLastPing(now)
      })
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
      stopFallbackInterval()
      releaseWakeLock()
      stopAudioRef.current?.()
      stopAudioRef.current = null
      setStatus("idle")
      clearMyLocation().catch(() => {})
      return
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported")
      return
    }

    setStatus("requesting")
    acquireWakeLock()

    // Start silent audio keepalive (prevents browser from fully suspending JS)
    startSilentAudio().then((stop) => { stopAudioRef.current = stop })

    const onPosition = (pos: GeolocationPosition) => sendPosition(pos)
    const onError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) setStatus("denied")
      else setStatus("error")
    }

    startWatch(onPosition, onError)
    startFallbackInterval(onPosition)

    // ── Reconnect on any foreground event ──────────────────────────────────
    // Covers: tab switch back, screen unlock → browser, network restore
    function handleForeground() {
      setIsHidden(false)
      // Immediately flush last known position — don't wait for GPS to warm up
      if (lastPosRef.current) {
        sendPosition(lastPosRef.current, true)
      }
      // Restart watch (browser may have paused it)
      startWatch(onPosition, onError)
      // Re-acquire wake lock (auto-released on screen lock)
      acquireWakeLock()
      // Re-start silent audio if it was stopped
      if (!stopAudioRef.current) {
        startSilentAudio().then((stop) => { stopAudioRef.current = stop })
      }
    }

    function handleHidden() {
      setIsHidden(true)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") handleForeground()
      else handleHidden()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleForeground)
    window.addEventListener("online", handleForeground)
    window.addEventListener("pageshow", handleForeground)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleForeground)
      window.removeEventListener("online", handleForeground)
      window.removeEventListener("pageshow", handleForeground)
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      stopFallbackInterval()
      releaseWakeLock()
      stopAudioRef.current?.()
      stopAudioRef.current = null
      clearMyLocation().catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, intervalMs, deliveryId])

  if (!showStatus) return null

  const cfg = (() => {
    switch (status) {
      case "broadcasting":
        return { color: "bg-green-400", text: "Sharing location", animate: true }
      case "requesting":
        return { color: "bg-yellow-400", text: "Requesting GPS…", animate: true }
      case "denied":
        return { color: "bg-[#ff6e84]", text: "Location permission denied", animate: false }
      case "unsupported":
        return { color: "bg-[#ff6e84]", text: "GPS not supported", animate: false }
      case "error":
        return { color: "bg-[#ff6e84]", text: "Location error — retrying", animate: true }
      case "idle":
      default:
        return { color: "bg-[#494847]", text: "Location off", animate: false }
    }
  })()

  // Show the keep-screen-on warning if wake lock was denied OR page is hidden
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

      {/* Persistent warning banner — shown when screen lock risk is high */}
      {showScreenWarning && (
        <div className="flex items-start gap-2 bg-amber-400/10 border border-amber-400/30 rounded-xl px-3 py-2.5 max-w-sm">
          <span className="material-symbols-outlined text-amber-400 text-base shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
            screen_lock_portrait
          </span>
          <p className="text-[11px] text-amber-300 leading-relaxed font-medium">
            <span className="font-bold text-amber-400">Keep this screen open.</span>{" "}
            Locking your phone or switching apps will pause location sharing.
          </p>
        </div>
      )}
    </div>
  )
}
