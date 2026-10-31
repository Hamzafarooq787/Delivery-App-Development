import {recordHealth} from "@/lib/integration-health"
/**
 * lib/google-server.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-only Google Directions call. Used by the pricing engine to compute
 * the AUTHORITATIVE route distance and traffic-aware duration — never trust
 * client-supplied distance/duration for pricing (see app/actions/pricing.ts).
 *
 * Calls the Google Maps API directly rather than going through
 * /api/google/directions to avoid an extra internal HTTP hop from a server
 * action that's already running server-side.
 *
 * Server-only: reads GOOGLE_MAPS_KEY (no NEXT_PUBLIC_ prefix). Only import
 * this from "use server" files — never from a client component.
 */

export type ServerRouteResult = {
  distance_km: number
  distance_miles: number
  duration_min: number
  /** Traffic-aware duration in minutes — null if Google didn't return one. */
  duration_in_traffic_min: number | null
}

export async function fetchRouteServer(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<ServerRouteResult | null> {
  const key = process.env.GOOGLE_MAPS_KEY
  if (!key) {
    console.error("[google-server] GOOGLE_MAPS_KEY is not set")
    return null
  }

  try {
    const url =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}` +
      `&departure_time=now&key=${key}`

    const res = await fetch(url)
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) { await recordHealth("maps",false,"Route could not be calculated"); return null }

    const leg = route.legs?.[0]
    if (!leg?.distance?.value || !leg?.duration?.value) return null

    const distance_km = leg.distance.value / 1000

    await recordHealth("maps",true,"Driving route calculated")
    return {
      distance_km,
      distance_miles: distance_km / 1.609344,
      duration_min: Math.round(leg.duration.value / 60),
      duration_in_traffic_min: leg.duration_in_traffic?.value
        ? Math.round(leg.duration_in_traffic.value / 60)
        : null,
    }
  } catch (error) {
    console.error("[google-server] fetchRouteServer failed:", error)
    return null
  }
}
