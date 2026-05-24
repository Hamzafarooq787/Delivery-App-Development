/**
 * POST /api/push/subscribe
 *
 * Saves a browser PushSubscription to the database so the server can
 * send Web Push notifications to this device later.
 *
 * Body: { endpoint, p256dh, auth, userAgent? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { createAdminClient }         from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { endpoint, p256dh, auth, userAgent } = body

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Missing subscription fields' }, { status: 400 })
    }

    // Determine role from users table
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role ?? 'customer'

    // Upsert on endpoint (one row per browser/device)
    const { error } = await admin.from('push_subscriptions').upsert(
      { user_id: user.id, role, endpoint, p256dh, auth, user_agent: userAgent ?? null },
      { onConflict: 'endpoint' }
    )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
