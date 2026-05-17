// NEXT_PUBLIC key is only used by the map loader in the browser.
// All REST API calls go through server-side /api/google/* routes.

export type PlaceSuggestion = { text: string; placeId: string }

export type LngLat = { lng: number; lat: number }

export type RouteResult = {
  distance_km: number
  distance_miles: number
  duration_min: number
  geometry: GeoJSON.LineString
}

function decodePoly(encoded: string): [number, number][] {
  let index = 0, lat = 0, lng = 0
  const coords: [number, number][] = []
  while (index < encoded.length) {
    let shift = 0, result = 0, b: number
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : (result >> 1)
    shift = 0; result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : (result >> 1)
    coords.push([lng / 1e5, lat / 1e5])
  }
  return coords
}

export async function googlePlacesAutocomplete(
  input: string,
  opts: { proximity?: { lat: number; lng: number }; countryCode?: string | null }
): Promise<PlaceSuggestion[]> {
  const body: Record<string, unknown> = { input, languageCode: 'en' }
  if (opts.proximity) {
    body.locationBias = {
      circle: {
        center: { latitude: opts.proximity.lat, longitude: opts.proximity.lng },
        radius: 50000,
      },
    }
  }
  if (opts.countryCode) body.includedRegionCodes = [opts.countryCode]

  const res = await fetch('/api/google/autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return (data.suggestions || [])
    .map((s: any) => ({
      text: s.placePredictions?.text?.text || '',
      placeId: s.placePredictions?.placeId || '',
    }))
    .filter((s: PlaceSuggestion) => s.text && s.placeId)
}

export async function googlePlaceCoords(
  placeId: string
): Promise<{ lat: number; lng: number } | null> {
  const res = await fetch(`/api/google/place?placeId=${encodeURIComponent(placeId)}`)
  const data = await res.json()
  if (!data.location) return null
  return { lat: data.location.latitude, lng: data.location.longitude }
}

export async function googleReverseGeocode(lat: number, lng: number): Promise<string | null> {
  const res = await fetch(`/api/google/geocode?latlng=${lat},${lng}`)
  const data = await res.json()
  return data.results?.[0]?.formatted_address || null
}

export async function googleDetectCountryCode(lat: number, lng: number): Promise<string | null> {
  const res = await fetch(`/api/google/geocode?latlng=${lat},${lng}&result_type=country`)
  const data = await res.json()
  const country = data.results?.[0]?.address_components?.find(
    (c: any) => c.types.includes('country')
  )
  return country?.short_name?.toLowerCase() || null
}

export async function fetchRoute(from: LngLat, to: LngLat): Promise<RouteResult | null> {
  try {
    const res = await fetch(
      `/api/google/directions?origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}`
    )
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) return null
    const leg = route.legs?.[0]
    const distance_km = (leg?.distance?.value ?? 0) / 1000
    const coords = decodePoly(route.overview_polyline.points)
    return {
      distance_km: Math.round(distance_km * 10) / 10,
      distance_miles: Math.round(distance_km * 0.621371 * 10) / 10,
      duration_min: Math.round((leg?.duration?.value ?? 0) / 60),
      geometry: { type: 'LineString', coordinates: coords },
    }
  } catch {
    return null
  }
}
