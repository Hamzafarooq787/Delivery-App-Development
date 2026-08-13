import { NextRequest, NextResponse } from 'next/server'

const KEY = process.env.GOOGLE_MAPS_KEY!

// Deliberately NOT auth-gated, unlike the other /api/google/* routes —
// app/signup/page.tsx reverse-geocodes the user's GPS location to prefill
// an address before they have a session. Everything else that touches the
// Google Maps API requires login; this is the one necessary exception.
export async function GET(req: NextRequest) {
  const latlng = req.nextUrl.searchParams.get('latlng')
  const resultType = req.nextUrl.searchParams.get('result_type') ?? ''
  if (!latlng) return NextResponse.json({ error: 'missing latlng' }, { status: 400 })
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latlng}${resultType ? `&result_type=${resultType}` : ''}&key=${KEY}`
  const res = await fetch(url)
  const data = await res.json()
  return NextResponse.json(data)
}
