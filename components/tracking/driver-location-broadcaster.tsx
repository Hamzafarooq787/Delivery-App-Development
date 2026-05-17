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
  const lastSentRef = useRef<number>(0)
  const watchIdRef = useRef<number | null>(null)
  const inFlightRef = useRef<boolean>(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Acquire wake lock to prevent screen sleep
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

  function startWatch(onPos: PositionCallback, onErr: PositionErrorCallback) {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }
    const id = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 15000,
    })
    watchIdRef.current = id
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

  useEffect(() => {
    if (disabled) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      stopFallbackInterval()
      releaseWakeLock()
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

    const onPosition = (pos: GeolocationPosition) => {
      const now = Date.now()
      if (inFlightRef.current) return
      if (now - lastSentRef.current < intervalMs) return

      lastSentRef.current = now
      inFlightRef.current = true
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
        .finally(() => {
          inFlightRef.current = false
        })
    }

    const onError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) setStatus("denied")
      else setStatus("error")
    }

    startWatch(onPosition, onError)
    startFallbackInterval(onPosition)

    // Restart watchPosition when tab becomes visible again (browser pauses it when hidden)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startWatch(onPosition, onError)
        // Re-acquire wake lock (released when screen locked)
        acquireWakeLock()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      stopFallbackInterval()
      releaseWakeLock()
      clearMyLocation().catch(() => {})
    }
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
        return { color: "bg-[#ff6e84]", text: "Location error", animate: false }
      case "idle":
      default:
        return { color: "bg-[#494847]", text: "Location off", animate: false }
    }
  })()

  return (
    <div className="space-y-1.5">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a1919] border border-[#494847]/30 ${className ?? ""}`}>
        <span className={`w-2 h-2 rounded-full ${cfg.color} ${cfg.animate ? "animate-pulse" : ""}`} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-white">{cfg.text}</span>
        {lastPing && status === "broadcasting" && (
          <span className="text-[10px] text-[#adaaaa] normal-case font-medium tracking-normal">
            • {new Date(lastPing).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        )}
      </div>
      {wakeLockDenied && status === "broadcasting" && (
        <p className="text-[10px] text-yellow-400 px-1">
          Keep this screen open — your device may pause location sharing when locked.
        </p>
      )}
    </div>
  )
}
