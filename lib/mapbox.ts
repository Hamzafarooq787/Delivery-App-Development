export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

export const DARK_STYLE = "mapbox://styles/mapbox/dark-v11"

export type LngLat = { lng: number; lat: number }

export type RouteResult = {
  distance_km: number
  distance_miles: number
  duration_min: number
  geometry: GeoJSON.LineString
}

export async function fetchRoute(from: LngLat, to: LngLat): Promise<RouteResult | null> {
  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const route = json.routes?.[0]
    if (!route) return null
    const distance_km = route.distance / 1000
    return {
      distance_km: Math.round(distance_km * 10) / 10,
      distance_miles: Math.round(distance_km * 0.621371 * 10) / 10,
      duration_min: Math.round(route.duration / 60),
      geometry: route.geometry,
    }
  } catch {
    return null
  }
}
