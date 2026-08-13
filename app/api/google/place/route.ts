import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const KEY = process.env.GOOGLE_MAPS_KEY

export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'GOOGLE_MAPS_KEY not set' }, { status: 500 })

  // Require a session — was previously reachable by anyone with no auth or
  // rate limit, burning the Google Maps budget.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const placeId = req.nextUrl.searchParams.get('placeId')
  if (!placeId) return NextResponse.json({ error: 'missing placeId' }, { status: 400 })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry&key=${KEY}`
  )
  const data = await res.json()
  const loc = data.result?.geometry?.location
  if (!loc) return NextResponse.json({ error: 'no location', status: data.status }, { status: 404 })

  // Normalise to the shape lib/google.ts expects: { location: { latitude, longitude } }
  return NextResponse.json({ location: { latitude: loc.lat, longitude: loc.lng } })
}
