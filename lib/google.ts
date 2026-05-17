const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!

export type PlaceSuggestion = { text: string; placeId: string }

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
