import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const KEY = process.env.GOOGLE_MAPS_KEY!

export async function GET(req: NextRequest) {
  // Require a session — this was previously reachable by anyone on the
  // internet with no auth or rate limit, burning the Google Maps budget.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const origin = req.nextUrl.searchParams.get('origin')
  const destination = req.nextUrl.searchParams.get('destination')
  if (!origin || !destination) return NextResponse.json({ error: 'missing params' }, { status: 400 })
  if (origin.length>400||destination.length>400) return NextResponse.json({error:'Address is too long'},{status:400})
  // departure_time=now requests traffic-aware duration (duration_in_traffic)
  // alongside the static duration, used for heavy-traffic surge pricing.
  const res = await fetch(
    'https://maps.googleapis.com/maps/api/directions/json?'+new URLSearchParams({origin,destination,departure_time:'now',key:KEY})
  )
  const data = await res.json()
  return NextResponse.json(data)
}
