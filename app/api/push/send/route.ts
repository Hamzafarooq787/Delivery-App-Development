/**
 * POST /api/push/send
 *
 * Sends a Web Push notification to all subscribed drivers (or a specific user).
 * Called internally — from NewDeliveryModal after a customer places an order.
 *
 * Body:
 *   {
 *     role?:    "driver"            // target all drivers (default)
 *     userId?:  string              // OR target a specific user
 *     title:    string
 *     body:     string
 *     url?:     string              // tap-to-open URL (default: /dashboard/driver/jobs/available)
 *     tag?:     string              // notification tag for deduplication
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import webpush                       from 'web-push'
import { createAdminClient }         from '@/lib/supabase/admin'

const VAPID_PUBLIC_KEY  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY            ?? ''
const VAPID_EMAIL       = process.env.VAPID_EMAIL                  ?? 'mailto:admin@example.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

export async function POST(req: NextRequest) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const {
      role    = 'driver',
      userId,
      title,
      body:   notifBody,
      url     = '/dashboard/driver/jobs/available',
      tag     = 'new-job',
    } = body

    if (!title || !notifBody) {
      return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Fetch target subscriptions
    let query = admin.from('push_subscriptions').select('endpoint, p256dh, auth')
    if (userId) {
      query = query.eq('user_id', userId)
    } else {
      query = query.eq('role', role)
    }
    const { data: subs, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 })

    const payload = JSON.stringify({
      title,
      body:  notifBody,
      url,
      tag,
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
    })

    // Send to every subscribed device in parallel; collect expired endpoints for cleanup
    const expiredEndpoints: string[] = []

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 60 * 60 }  // keep in push server queue for up to 1 hour
          )
        } catch (err: any) {
          // 410 Gone / 404 = subscription expired — clean up
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            expiredEndpoints.push(sub.endpoint)
          }
        }
      })
    )

    // Remove expired subscriptions
    if (expiredEndpoints.length > 0) {
      await admin
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints)
    }

    return NextResponse.json({ ok: true, sent: subs.length - expiredEndpoints.length })
  } catch (err) {
    console.error('[push/send]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
