import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const KEY = process.env.GOOGLE_MAPS_KEY

export async function POST(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'GOOGLE_MAPS_KEY not set' }, { status: 500 })

  // Require a session — was previously reachable by anyone with no auth or
  // rate limit, burning the Google Maps budget.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { input, locationBias, includedRegionCodes } = await req.json()

  const params = new URLSearchParams({ input, key: KEY, language: 'en' })
  if (locationBias?.circle?.center) {
    const { latitude: lat, longitude: lng } = locationBias.circle.center
    params.set('location', `${lat},${lng}`)
    params.set('radius', String(locationBias.circle.radius ?? 50000))
  }
  if (includedRegionCodes?.[0]) {
    params.set('components', `country:${includedRegionCodes[0]}`)
  }

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`
  )
  const data = await res.json()

  // Normalise to the shape lib/google.ts expects
  const suggestions = (data.predictions ?? []).map((p: any) => ({
    placePredictions: {
      text: { text: p.description },
      placeId: p.place_id,
    },
  }))
  return NextResponse.json({ suggestions, status: data.status, error_message: data.error_message })
}
