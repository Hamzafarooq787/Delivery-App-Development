import { NextResponse } from 'next/server'

const KEY = process.env.GOOGLE_MAPS_KEY

export async function GET() {
  if (!KEY) return NextResponse.json({ error: 'GOOGLE_MAPS_KEY env var is not set on the server' })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=mirpur&components=country:pk&key=${KEY}`
  )
  const data = await res.json()
  return NextResponse.json({ keyPresent: true, keyLength: KEY.length, response: data })
}
