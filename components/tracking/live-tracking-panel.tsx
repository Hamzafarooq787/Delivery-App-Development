"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchRoute } from "@/lib/google"

const GoogleLiveMap = dynamic(
  () => import("@/components/maps/google-live-map").then((m) => m.GoogleLiveMap),
  { ssr: false }
)

type Props = {
  driverId: string | null
  pickup: { lat: number; lng: number } | null
  destination: { lat: number; lng: number } | null
  customerId?: string | null
  deliveryId?: string | null
  driverLabel?: string
  height?: number | string
  followDriver?: boolean
  isDriverView?: boolean
}

export function LiveTrackingPanel({
  driverId,
  pickup,
  destination,
  customerId,
  deliveryId = null,
  driverLabel = "Driver",
  height = 400,
  followDriver = false,
  isDriverView = false,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null)
  const [customerPos, setCustomerPos] = useState<{ lat: number; lng: number } | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)
  const [stale, setStale] = useState(false)
  const [route1, setRoute1] = useState<GeoJSON.LineString | null>(null)   // pickup→destination
  const [route2, setRoute2] = useState<GeoJSON.LineString | null>(null)   // driver→pickup

  // Subscribe to driver location
  useEffect(() => {
    if (!driverId) return
    supabase
      .from("driver_locations")
      .select("lat, lng, updated_at")
      .eq("driver_id", driverId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setDriverPos({ lat: data.lat, lng: data.lng })
        setLastUpdate(Date.now())
      })

    const channel = supabase
      .channel(`live-tracking-${driverId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "driver_locations",
        filter: `driver_id=eq.${driverId}`,
      }, (payload) => {
        const row = payload.new as any
        if (!row) return
        setDriverPos({ lat: row.lat, lng: row.lng })
        setLastUpdate(Date.now())
        setStale(false)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, driverId])

  // Subscribe to customer location
  useEffect(() => {
    if (!customerId) return
    supabase
      .from("customer_locations")
      .select("lat, lng, delivery_id")
      .eq("customer_id", customerId)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.delivery_id === deliveryId) setCustomerPos({ lat: data.lat, lng: data.lng })
      })

    const channel = supabase
      .channel(`customer-loc-${customerId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "customer_locations",
        filter: `customer_id=eq.${customerId}`,
      }, (payload) => {
        const row = payload.new as any
        if (row?.lat != null && row?.delivery_id === deliveryId) setCustomerPos({ lat: row.lat, lng: row.lng })
        else setCustomerPos(null)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, customerId, deliveryId])

  // Stale detection — 45 seconds before showing "Signal lost"
  useEffect(() => {
    if (!lastUpdate) return
    const t = setTimeout(() => setStale(true), 45_000)
    return () => clearTimeout(t)
  }, [lastUpdate])

  // Fetch pickup→destination route once when both coords are available
  useEffect(() => {
    if (!pickup || !destination) { setRoute1(null); return }
    fetchRoute(
      { lat: pickup.lat, lng: pickup.lng },
      { lat: destination.lat, lng: destination.lng }
    ).then((r) => setRoute1(r?.geometry ?? null)).catch(() => {})
  }, [pickup?.lat, pickup?.lng, destination?.lat, destination?.lng])

  // When isDriverView is true and driverPos is available, fetch driver→pickup route
  useEffect(() => {
    if (!isDriverView || !driverPos || !pickup) { setRoute2(null); return }
    fetchRoute(
      { lat: driverPos.lat, lng: driverPos.lng },
      { lat: pickup.lat, lng: pickup.lng }
    ).then((r) => setRoute2(r?.geometry ?? null)).catch(() => {})
  }, [isDriverView, driverPos?.lat, driverPos?.lng, pickup?.lat, pickup?.lng])

  const drivers = driverPos && driverId
    ? [{ id: driverId, label: driverLabel, position: { lng: driverPos.lng, lat: driverPos.lat }, isAccepted: true }]
    : []

  const badge = !driverId
    ? { label: "Awaiting driver", color: "bg-[#494847]" }
    : !driverPos
    ? { label: "Acquiring GPS…", color: "bg-amber-400 animate-pulse" }
    : stale
    ? { label: "Signal lost", color: "bg-red-400" }
    : { label: "Live", color: "bg-green-400 animate-pulse" }

  return (
    <div className="relative" style={{ height }}>
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-[#0e0e0e]/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-[#494847]/20">
        <span className={`w-2 h-2 rounded-full ${badge.color}`} />
        <span className="text-[10px] font-bold text-white uppercase tracking-wider">{badge.label}</span>
        {lastUpdate && !stale && (
          <span className="text-[9px] text-[#adaaaa] ml-1">
            {Math.round((Date.now() - lastUpdate) / 1000)}s ago
          </span>
        )}
      </div>
      {customerPos && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-[#0e0e0e]/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-cyan-500/30">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">Customer Live</span>
        </div>
      )}
      <GoogleLiveMap
        drivers={drivers}
        pickup={pickup ? { lng: pickup.lng, lat: pickup.lat } : null}
        destination={destination ? { lng: destination.lng, lat: destination.lat } : null}
        customerLocation={customerPos ? { lng: customerPos.lng, lat: customerPos.lat } : null}
        routeGeometry={route1}
        routeGeometry2={isDriverView ? route2 : null}
        height="100%"
        followDriverId={followDriver && driverId ? driverId : null}
      />
    </div>
  )
}
