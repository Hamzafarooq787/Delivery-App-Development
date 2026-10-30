"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useTrackingRoute } from "@/hooks/use-tracking-route"
import { goesToDestination } from "@/lib/tracking-utils"

const GoogleLiveMap = dynamic(
  () => import("@/components/maps/google-live-map").then((m) => m.GoogleLiveMap),
  { ssr: false }
)

type Props = {
  status?: string
  bfmStage?: string | null
  driverId: string | null
  pickup: { lat: number; lng: number } | null
  destination: { lat: number; lng: number } | null
  customerId?: string | null
  deliveryId?: string | null
  driverLabel?: string
  height?: number | string
  followDriver?: boolean
  isDriverView?: boolean
  /** Only show the driver's location while it is being broadcast for `deliveryId` (a driver can have several active jobs). */
  matchDeliveryId?: boolean
  /** Ask the viewer for their own location and show it on the map. Defaults to true. */
  showViewerLocation?: boolean
}

export function LiveTrackingPanel({
  status,
  bfmStage,
  driverId,
  pickup,
  destination,
  customerId,
  deliveryId = null,
  driverLabel = "Driver",
  height = 400,
  followDriver = false,
  isDriverView = false,
  matchDeliveryId = false,
  showViewerLocation = true,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null)
  const [customerPos, setCustomerPos] = useState<{ lat: number; lng: number } | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)
  const [stale, setStale] = useState(false)
  const route1 = useTrackingRoute(pickup, destination)
  const target = goesToDestination(status, bfmStage) ? destination : pickup
  const route2 = useTrackingRoute(isDriverView ? driverPos : null, target, true)

  // Subscribe to driver location
  useEffect(() => {
    setDriverPos(null)
    setLastUpdate(null)
    if (!driverId) return
    supabase
      .from("driver_locations")
      .select("lat, lng, updated_at, delivery_id")
      .eq("driver_id", driverId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        if (matchDeliveryId && deliveryId && data.delivery_id !== deliveryId) return
        setDriverPos({ lat: data.lat, lng: data.lng })
        setLastUpdate(Date.parse(data.updated_at))
      })

    const channel = supabase
      .channel(`live-tracking-${driverId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "driver_locations",
        filter: `driver_id=eq.${driverId}`,
      }, (payload) => {
        const row = payload.new as any
        if (typeof row?.lat !== "number" || typeof row?.lng !== "number") return
        if (matchDeliveryId && deliveryId && row.delivery_id !== deliveryId) {
          // Driver is now broadcasting for a different delivery — don't show it against this route
          setDriverPos(null)
          return
        }
        setDriverPos({ lat: row.lat, lng: row.lng })
        setLastUpdate(Date.parse(row.updated_at))
        setStale(false)
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "driver_locations",
        filter: `driver_id=eq.${driverId}`,
      }, (payload) => {
        const row = payload.new as any
        if (typeof row?.lat !== "number" || typeof row?.lng !== "number") return
        if (matchDeliveryId && deliveryId && row.delivery_id !== deliveryId) {
          // Driver is now broadcasting for a different delivery — don't show it against this route
          setDriverPos(null)
          return
        }
        setDriverPos({ lat: row.lat, lng: row.lng })
        setLastUpdate(Date.parse(row.updated_at))
        setStale(false)
      })
      .on("postgres_changes", {
        event: "DELETE",
        schema: "public",
        table: "driver_locations",
        filter: `driver_id=eq.${driverId}`,
      }, () => {
        // Driver completed delivery — clear position gracefully (don't crash map)
        setDriverPos(null)
        setStale(false)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, driverId, matchDeliveryId, deliveryId])

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
    const remaining = Math.max(0, 45_000 - (Date.now() - lastUpdate))
    setStale(remaining === 0)
    const t = setTimeout(() => setStale(true), remaining)
    return () => clearTimeout(t)
  }, [lastUpdate])

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
        showUserLocation={showViewerLocation}
      />
    </div>
  )
}
