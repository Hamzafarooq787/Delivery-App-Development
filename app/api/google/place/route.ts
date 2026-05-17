import { NextRequest, NextResponse } from 'next/server'

const KEY = process.env.GOOGLE_MAPS_KEY!

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('placeId')
  if (!placeId) return NextResponse.json({ error: 'missing placeId' }, { status: 400 })
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?fields=location&key=${KEY}`
  )
  const data = await res.json()
  return NextResponse.json(data)
}
