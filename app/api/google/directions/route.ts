import { NextRequest, NextResponse } from 'next/server'

const KEY = process.env.GOOGLE_MAPS_KEY!

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get('origin')
  const destination = req.nextUrl.searchParams.get('destination')
  if (!origin || !destination) return NextResponse.json({ error: 'missing params' }, { status: 400 })
  // departure_time=now requests traffic-aware duration (duration_in_traffic)
  // alongside the static duration, used for heavy-traffic surge pricing.
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&departure_time=now&key=${KEY}`
  )
  const data = await res.json()
  return NextResponse.json(data)
}
