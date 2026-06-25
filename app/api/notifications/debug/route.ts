/**
 * app/api/notifications/debug/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Diagnostic endpoint — hit this while logged in to see exactly where the
 * push notification pipeline is broken.
 *
 * GET /api/notifications/debug
 *
 * Returns a JSON report covering every layer:
 *   1. Firebase client env vars (are they set?)
 *   2. Firebase Admin env vars (are they set?)
 *   3. Firebase Admin SDK init (does it throw?)
 *   4. FCM tokens in Supabase for the current user (how many? any rows?)
 *   5. A real test send to the current user's registered tokens
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const report: Record<string, unknown> = {}

  // ── 1. Auth check ────────────────────────────────────────────────────────────
  let userId: string | null = null
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: "Not authenticated — log in first, then visit this URL." }, { status: 401 })
    }
    userId = user.id
    report.userId = userId
    report.email = user.email
  } catch (e: any) {
    return NextResponse.json({ error: "Auth error", detail: e?.message }, { status: 500 })
  }

  // ── 2. Firebase client env vars ───────────────────────────────────────────────
  report.clientEnvVars = {
    NEXT_PUBLIC_FIREBASE_API_KEY:              !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:          !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:           !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:       !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:  !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID:               !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_VAPID_KEY:            !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  }

  // ── 3. Firebase Admin env vars ───────────────────────────────────────────────
  const adminPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? ""
  report.adminEnvVars = {
    FIREBASE_ADMIN_PROJECT_ID:    !!process.env.FIREBASE_ADMIN_PROJECT_ID,
    FIREBASE_ADMIN_CLIENT_EMAIL:  !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    FIREBASE_ADMIN_PRIVATE_KEY:   !!adminPrivateKey,
    // Show whether the key looks right (has PEM header) without exposing it
    privateKeyLooksValid: adminPrivateKey.includes("BEGIN") && adminPrivateKey.includes("END"),
    privateKeyLength: adminPrivateKey.length,
  }

  // ── 4. Firebase Admin SDK init ───────────────────────────────────────────────
  try {
    const { getFirebaseAdminMessaging } = await import("@/lib/firebase/admin")
    getFirebaseAdminMessaging()
    report.adminSdkInit = "OK"
  } catch (e: any) {
    report.adminSdkInit = "FAILED"
    report.adminSdkError = e?.message ?? String(e)
  }

  // ── 5. FCM tokens in Supabase for this user ───────────────────────────────────
  try {
    const admin = createAdminClient()
    const { data: tokens, error } = await admin
      .from("user_notification_tokens")
      .select("id, fcm_token, device_type, created_at, updated_at")
      .eq("user_id", userId)

    if (error) {
      report.tokenQuery = "FAILED"
      report.tokenQueryError = error.message
    } else {
      report.tokenCount = tokens?.length ?? 0
      report.tokens = tokens?.map((t) => ({
        id: t.id,
        device_type: t.device_type,
        // Show only first 20 chars of token to avoid leaking it
        token_preview: t.fcm_token?.slice(0, 20) + "…",
        created_at: t.created_at,
        updated_at: t.updated_at,
      }))
    }
  } catch (e: any) {
    report.tokenQuery = "FAILED"
    report.tokenQueryError = e?.message ?? String(e)
  }

  // ── 6. Test send — only when ?send=1 is present (opt-in, avoids side effects on plain GET) ──
  const sendTest = new URL(req.url).searchParams.get("send") === "1"
  if (!sendTest) {
    report.testSend = "SKIPPED — add ?send=1 to the URL to fire a real test push"
  } else if (report.adminSdkInit !== "OK") {
    report.testSend = "SKIPPED — Admin SDK failed to initialize"
  } else if ((report.tokenCount as number) === 0) {
    report.testSend = "SKIPPED — No FCM tokens registered for this user"
  } else {
    try {
      const { sendPushNotification } = await import("@/lib/notifications/send")
      const result = await sendPushNotification({
        userId: userId!,
        notification: {
          title: "🔔 Go Drop Debug Test",
          body: "Push notification pipeline is working correctly!",
          url: "/dashboard",
          tag: "debug-test",
        },
      })
      report.testSend = result
    } catch (e: any) {
      report.testSend = "FAILED"
      report.testSendError = e?.message ?? String(e)
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  const clientVarsOk = Object.values(report.clientEnvVars as Record<string, boolean>).every(Boolean)
  const adminVarsOk  = !!(process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && adminPrivateKey)
  const hasTokens    = (report.tokenCount as number) > 0
  const sdkOk        = report.adminSdkInit === "OK"

  report.diagnosis = {
    clientEnvVars:  clientVarsOk ? "✅ All set"        : "❌ MISSING — check Vercel env vars",
    adminEnvVars:   adminVarsOk  ? "✅ All set"        : "❌ MISSING — check Vercel env vars",
    privateKeyValid:(report.adminEnvVars as any).privateKeyLooksValid ? "✅ PEM format looks correct" : "❌ Key missing or malformed",
    adminSdkInit:   sdkOk        ? "✅ Initialized OK" : "❌ FAILED — see adminSdkError",
    fcmTokens:      hasTokens    ? `✅ ${report.tokenCount} token(s) registered` : "❌ NO TOKENS — user must grant notification permission in the app",
    overallStatus:  (clientVarsOk && adminVarsOk && sdkOk && hasTokens)
      ? "✅ Pipeline looks healthy — if notifications still fail, check FCM quota or token validity"
      : "❌ Pipeline broken — fix the ❌ items above",
  }

  return NextResponse.json(report, { status: 200 })
}
