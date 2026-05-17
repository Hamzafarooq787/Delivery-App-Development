import { NextRequest, NextResponse } from 'next/server'

const KEY = process.env.GOOGLE_MAPS_KEY!

export async function GET(req: NextRequest) {
  const latlng = req.nextUrl.searchParams.get('latlng')
  const resultType = req.nextUrl.searchParams.get('result_type') ?? ''
  if (!latlng) return NextResponse.json({ error: 'missing latlng' }, { status: 400 })
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latlng}${resultType ? `&result_type=${resultType}` : ''}&key=${KEY}`
  const res = await fetch(url)
  const data = await res.json()
  return NextResponse.json(data)
}
