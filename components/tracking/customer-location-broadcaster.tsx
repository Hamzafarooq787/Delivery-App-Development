"use client"

import { useEffect, useRef, useState } from "react"
import { updateCustomerLocation, clearCustomerLocation } from "@/app/actions/tracking"

type Props = {
  deliveryId?: string | null
  disabled?: boolean
  intervalMs?: number
}

export function CustomerLocationBroadcaster({ deliveryId = null, disabled = false, intervalMs = 6000 }: Props) {
  const [sharing, setSharing] = useState(false)
  const [denied, setDenied] = useState(false)
  const lastSentRef = useRef<number>(0)
  const watchIdRef = useRef<number | null>(null)
  const inFlightRef = useRef<boolean>(false)
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef = useRef<any>(null)

  async function acquireWakeLock() {
    if (!("wakeLock" in navigator)) return
    try { wakeLockRef.current = await (navigator as any).wakeLock.request("screen") } catch {}
  }

  function startWatch(onPos: PositionCallback) {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    watchIdRef.current = navigator.geolocation.watchPosition(onPos, () => {}, {
      enableHighAccuracy: true, maximumAge: 2000, timeout: 15000,
    })
  }

  useEffect(() => {
    if (disabled || !("geolocation" in navigator)) return

    const send = (pos: GeolocationPosition) => {
      const now = Date.now()
      if (inFlightRef.current || now - lastSentRef.current < intervalMs) return
      lastSentRef.current = now
      inFlightRef.current = true
      setSharing(true)
      updateCustomerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, delivery_id: deliveryId })
        .catch(() => {})
        .finally(() => { inFlightRef.current = false })
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => { send(pos); acquireWakeLock() },
      (err) => { if (err.code === err.PERMISSION_DENIED) setDenied(true) },
    )

    startWatch(send)

    fallbackTimerRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(send, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 })
    }, intervalMs * 2)

    const onVisible = () => { if (document.visibilityState === "visible") { startWatch(send); acquireWakeLock() } }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
      if (fallbackTimerRef.current) { clearInterval(fallbackTimerRef.current); fallbackTimerRef.current = null }
      if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null }
      clearCustomerLocation().catch(() => {})
    }
  }, [disabled, intervalMs, deliveryId])

  if (disabled) return null

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a1919] border border-[#494847]/30">
      <span className={`w-2 h-2 rounded-full ${denied ? "bg-red-400" : sharing ? "bg-cyan-400 animate-pulse" : "bg-yellow-400 animate-pulse"}`} />
      <span className="text-[10px] font-bold uppercase tracking-wider text-white">
        {denied ? "Location denied" : sharing ? "Sharing your location" : "Acquiring GPS…"}
      </span>
    </div>
  )
}
