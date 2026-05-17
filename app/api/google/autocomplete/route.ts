import { NextRequest, NextResponse } from 'next/server'

const KEY = process.env.GOOGLE_MAPS_KEY!

export async function POST(req: NextRequest) {
  const body = await req.json()
  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'suggestions.placePredictions.text,suggestions.placePredictions.placeId',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data)
}
