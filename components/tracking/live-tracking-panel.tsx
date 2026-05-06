"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { LatLng } from "./live-tracking-map"

const LiveTrackingMap = dynamic(
  () => import("./live-tracking-map").then((m) => m.LiveTrackingMap),
  { ssr: false, loading: () => <div style={{ height: 400, background: "#0e0e0e", borderRadius: 12 }} /> }
)

type Props = {
  driverId: string | null
  pickup?: LatLng | null
  destination?: LatLng | null
  driverLabel?: string
  height?: number | string
  followDriver?: boolean
}

export function LiveTrackingPanel({
  driverId,
  pickup,
  destination,
  driverLabel,
  height = 460,
  followDriver = false,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [driverLoc, setDriverLoc] = useState<LatLng | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [stale, setStale] = useState(false)

  useEffect(() => {
    if (!driverId) {
      setDriverLoc(null)
      setUpdatedAt(null)
      return
    }

    let cancelled = false

    async function loadInitial() {
      const { data } = await supabase
        .from("driver_locations")
        .select("lat, lng, updated_at")
        .eq("driver_id", driverId)
        .maybeSingle()

      if (cancelled || !data) return
      setDriverLoc({ lat: Number(data.lat), lng: Number(data.lng) })
      setUpdatedAt(data.updated_at as string)
    }
    loadInitial()

    const channel = supabase
      .channel(`driver-loc-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_locations",
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as
            | { lat: number; lng: number; updated_at: string }
            | undefined
          if (!row) return
          setDriverLoc({ lat: Number(row.lat), lng: Number(row.lng) })
          setUpdatedAt(row.updated_at)
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [supabase, driverId])

  // Mark stale if we haven't received an update in 30 seconds
  useEffect(() => {
    if (!updatedAt) return
    const tick = () => {
      const ageSec = (Date.now() - new Date(updatedAt).getTime()) / 1000
      setStale(ageSec > 30)
    }
    tick()
    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  }, [updatedAt])

  const ageLabel = useMemo(() => {
    if (!updatedAt) return null
    const ageSec = Math.max(0, (Date.now() - new Date(updatedAt).getTime()) / 1000)
    if (ageSec < 5) return "just now"
    if (ageSec < 60) return `${Math.round(ageSec)}s ago`
    const m = Math.round(ageSec / 60)
    return `${m}m ago`
  }, [updatedAt, stale])

  return (
    <div className="relative">
      <LiveTrackingMap
        driver={driverLoc}
        pickup={pickup}
        destination={destination}
        height={height}
        driverLabel={driverLabel}
        followDriver={followDriver}
      />

      <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0e0e0e]/85 backdrop-blur border border-[#494847]/30 text-[10px] font-bold uppercase tracking-wider">
        <span className={`w-2 h-2 rounded-full ${
          driverLoc
            ? stale ? "bg-yellow-400" : "bg-green-400 animate-pulse"
            : "bg-[#494847]"
        }`} />
        <span className="text-white">
          {driverLoc ? (stale ? "Signal Stale" : "Live") : "Awaiting GPS"}
        </span>
        {ageLabel && (
          <span className="text-[#adaaaa] normal-case font-medium tracking-normal">
            • {ageLabel}
          </span>
        )}
      </div>
    </div>
  )
}
