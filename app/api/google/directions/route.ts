import { NextRequest, NextResponse } from 'next/server'

const KEY = process.env.GOOGLE_MAPS_KEY!

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get('origin')
  const destination = req.nextUrl.searchParams.get('destination')
  if (!origin || !destination) return NextResponse.json({ error: 'missing params' }, { status: 400 })
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${KEY}`
  )
  const data = await res.json()
  return NextResponse.json(data)
}
