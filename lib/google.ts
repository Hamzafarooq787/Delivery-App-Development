const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!

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

export async function fetchRoute(from: LngLat, to: LngLat): Promise<RouteResult | null> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&key=${GOOGLE_KEY}`
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

/** Search addresses using Google Places Autocomplete (New API) */
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

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'suggestions.placePredictions.text,suggestions.placePredictions.placeId',
    },
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

/** Get lat/lng for a placeId from Google Place Details (New API) */
export async function googlePlaceCoords(
  placeId: string
): Promise<{ lat: number; lng: number } | null> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?fields=location&key=${GOOGLE_KEY}`
  )
  const data = await res.json()
  if (!data.location) return null
  return { lat: data.location.latitude, lng: data.location.longitude }
}

/** Convert GPS coords to a human-readable address via Google Geocoding */
export async function googleReverseGeocode(lat: number, lng: number): Promise<string | null> {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`
  )
  const data = await res.json()
  return data.results?.[0]?.formatted_address || null
}

/** Detect the user's country code (e.g. "pk") from GPS coords */
export async function googleDetectCountryCode(lat: number, lng: number): Promise<string | null> {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=country&key=${GOOGLE_KEY}`
  )
  const data = await res.json()
  const country = data.results?.[0]?.address_components?.find(
    (c: any) => c.types.includes('country')
  )
  return country?.short_name?.toLowerCase() || null
}
