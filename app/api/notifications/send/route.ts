/**
 * app/api/notifications/send/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Internal REST endpoint for sending push notifications server-to-server.
 *
 * POST /api/notifications/send
 *
 * Authorization rules:
 *   • Admin users can send to ANY user
 *   • Non-admin users can only trigger notifications for themselves
 *   • Unauthenticated requests are rejected
 *
 * Body (JSON):
 *   userId   string  — Supabase user ID of the recipient
 *   title    string  — Notification heading (required)
 *   body     string  — Notification body text
 *   url      string  — URL to open on click (default: "/")
 *   tag      string  — Deduplication tag
 *   image    string  — Optional large image URL
 *   data     object  — Extra string key-value pairs
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendPushNotification } from "@/lib/notifications/send"

export async function POST(req: NextRequest) {
  try {
    // ── Auth check ──────────────────────────────────────────────────────────
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // ── Parse request ────────────────────────────────────────────────────────
    const body = await req.json()
    const {
      userId,
      title,
      body: notifBody,
      url,
      tag,
      image,
      data,
    } = body as {
      userId?: string
      title?: string
      body?: string
      url?: string
      tag?: string
      image?: string
      data?: Record<string, string>
    }

    if (!userId || !title) {
      return NextResponse.json(
        { error: "userId and title are required" },
        { status: 400 }
      )
    }

    // ── Authorization: admin or self only ────────────────────────────────────
    const { data: callerProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (callerProfile?.role !== "admin" && user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // ── Send notification ────────────────────────────────────────────────────
    const result = await sendPushNotification({
      userId,
      notification: {
        title,
        body: notifBody ?? "",
        url,
        tag,
        image,
        data,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[API/send] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
