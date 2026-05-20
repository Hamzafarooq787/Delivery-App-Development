"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchRoute } from "@/lib/google"
import { GoogleLiveMap } from "./google-live-map"

type Delivery = {
  id: string
  tracking_number: string | null
  status: string
  driver_id: string | null
  driver_name: string | null
  pickup_lat?: number | null
  pickup_lng?: number | null
  delivery_lat?: number | null
  delivery_lng?: number | null
}

type DriverPosition = {
  id: string
  label: string
  position: { lng: number; lat: number }
  isAccepted: boolean
}

type Props = {
  deliveries: Delivery[]
  focusedDeliveryId?: string | null
  height?: number | string
  className?: string
}

export function GoogleMultiDriver({ deliveries, focusedDeliveryId, height = 420, className }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [positions, setPositions] = useState<Record<string, { lat: number; lng: number }>>({})
  const [liveCount, setLiveCount] = useState(0)
  const [routeGeometry, setRouteGeometry] = useState<GeoJSON.LineString | null>(null)
  const [routeGeometry2, setRouteGeometry2] = useState<GeoJSON.LineString | null>(null)

  const driverIds = useMemo(
    () => deliveries.map((d) => d.driver_id).filter(Boolean) as string[],
    [deliveries]
  )

  // Initial fetch of all online driver locations
  useEffect(() => {
    if (driverIds.length === 0) return
    supabase
      .from("driver_locations")
      .select("driver_id, lat, lng")
      .in("driver_id", driverIds)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, { lat: number; lng: number }> = {}
        data.forEach((r) => { map[r.driver_id] = { lat: r.lat, lng: r.lng } })
        setPositions(map)
        setLiveCount(data.length)
      })
  }, [supabase, driverIds.join(",")])

  // Realtime driver location updates
  useEffect(() => {
    if (driverIds.length === 0) return
    const channel = supabase
      .channel("google-multi-driver-locations")
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, (payload) => {
        const row = (payload.new ?? payload.old) as any
        if (!row || !driverIds.includes(row.driver_id)) return
        if (payload.eventType === "DELETE") {
          setPositions((prev) => { const n = { ...prev }; delete n[row.driver_id]; return n })
          setLiveCount((c) => Math.max(0, c - 1))
        } else {
          setPositions((prev) => ({ ...prev, [row.driver_id]: { lat: row.lat, lng: row.lng } }))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, driverIds.join(",")])

  // Focused delivery
  const focusedDelivery = useMemo(() => {
    if (focusedDeliveryId) return deliveries.find((d) => d.id === focusedDeliveryId) ?? deliveries[0] ?? null
    return deliveries[0] ?? null
  }, [deliveries, focusedDeliveryId])

  const pickup = focusedDelivery?.pickup_lat != null && focusedDelivery?.pickup_lng != null
    ? { lat: Number(focusedDelivery.pickup_lat), lng: Number(focusedDelivery.pickup_lng) }
    : null

  const destination = focusedDelivery?.delivery_lat != null && focusedDelivery?.delivery_lng != null
    ? { lat: Number(focusedDelivery.delivery_lat), lng: Number(focusedDelivery.delivery_lng) }
    : null

  const focusedDriverId = focusedDelivery?.driver_id ?? null
  const focusedDriverPos = focusedDriverId ? positions[focusedDriverId] ?? null : null

  // Fetch pickup→destination route when focused delivery changes
  useEffect(() => {
    if (!pickup || !destination) { setRouteGeometry(null); return }
    fetchRoute(pickup, destination)
      .then((r) => setRouteGeometry(r?.geometry ?? null))
      .catch(() => {})
  }, [pickup?.lat, pickup?.lng, destination?.lat, destination?.lng])

  // Fetch driver→pickup route when driver position is available
  useEffect(() => {
    if (!focusedDriverPos || !pickup) { setRouteGeometry2(null); return }
    fetchRoute(focusedDriverPos, pickup)
      .then((r) => setRouteGeometry2(r?.geometry ?? null))
      .catch(() => {})
  }, [focusedDriverPos?.lat, focusedDriverPos?.lng, pickup?.lat, pickup?.lng])

  const drivers: DriverPosition[] = deliveries
    .filter((d) => d.driver_id && positions[d.driver_id])
    .map((d) => ({
      id: d.driver_id!,
      label: d.driver_name || "Driver",
      position: { lng: positions[d.driver_id!].lng, lat: positions[d.driver_id!].lat },
      isAccepted: ["accepted", "collected", "in_transit"].includes(d.status),
    }))

  return (
    <div className={className} style={{ position: "relative" }}>
      {/* Live badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-[#0e0e0e]/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-[#494847]/20">
        <span className={`w-2 h-2 rounded-full ${liveCount > 0 ? "bg-green-400 animate-pulse" : "bg-[#494847]"}`} />
        <span className="text-[10px] font-bold text-white uppercase tracking-wider">
          {liveCount > 0 ? `${liveCount} driver${liveCount > 1 ? "s" : ""} live` : "No drivers active"}
        </span>
      </div>

      <GoogleLiveMap
        drivers={drivers}
        pickup={pickup}
        destination={destination}
        routeGeometry={routeGeometry}
        routeGeometry2={routeGeometry2}
        followDriverId={focusedDriverId}
        height={height}
      />
    </div>
  )
}
