/**
 * POST /api/sw-location
 *
 * Lightweight route handler called by the Location Service Worker.
 * Service Workers cannot call Next.js server actions, but they CAN call
 * API routes — cookies (including the Supabase auth session) are forwarded
 * automatically on same-origin requests, so auth still works.
 *
 * Accepts the driver's last-known position and upserts it into driver_locations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { createAdminClient }         from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    // Auth: read session from cookies (forwarded by SW fetch automatically)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { lat, lng, heading, speed, accuracy, delivery_id } = body

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin.from('driver_locations').upsert(
      {
        driver_id:  user.id,
        delivery_id: delivery_id ?? null,
        lat,
        lng,
        heading:    heading  ?? null,
        speed:      speed    ?? null,
        accuracy:   accuracy ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'driver_id' }
    )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
