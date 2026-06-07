/**
 * app/api/notifications/token/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * REST API for managing FCM device tokens.
 *
 * POST  /api/notifications/token  — register / refresh a token
 * DELETE /api/notifications/token — remove a token (logout / user opt-out)
 *
 * All routes require an active Supabase session (cookie-based auth).
 * Tokens are upserted so duplicate registrations are idempotent.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// ── POST — save / refresh a device token ─────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Verify the request is from an authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { token, deviceType } = body as { token?: string; deviceType?: string }

    if (!token || typeof token !== "string" || token.length < 10) {
      return NextResponse.json({ error: "Invalid FCM token" }, { status: 400 })
    }

    // Use admin client to bypass RLS — the route is already auth-gated
    const admin = createAdminClient()

    const { error } = await admin
      .from("user_notification_tokens")
      .upsert(
        {
          user_id: user.id,
          fcm_token: token,
          device_type: (deviceType ?? "web") as "web" | "mobile" | "desktop",
          updated_at: new Date().toISOString(),
        },
        {
          // The UNIQUE constraint on (user_id, fcm_token) drives the upsert
          onConflict: "user_id,fcm_token",
          ignoreDuplicates: false, // Always update updated_at on refresh
        }
      )

    if (error) {
      console.error("[API/token] Upsert error:", error)
      return NextResponse.json({ error: "Failed to save token" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API/token] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── DELETE — remove a token (logout / permission revoked) ────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { token } = body as { token?: string }

    const admin = createAdminClient()

    let query = admin
      .from("user_notification_tokens")
      .delete()
      .eq("user_id", user.id)

    if (token) {
      // Remove only the specific device token
      query = query.eq("fcm_token", token) as typeof query
    }
    // If no token provided, removes ALL tokens for this user (full logout)

    const { error } = await query

    if (error) {
      console.error("[API/token] Delete error:", error)
      return NextResponse.json({ error: "Failed to remove token" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API/token] DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
