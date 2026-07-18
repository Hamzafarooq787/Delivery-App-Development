/**
 * app/api/stripe/debug/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Diagnostic endpoint — hit this while logged in to see exactly where the
 * Stripe payment/wallet pipeline is broken. Read-only except it never
 * triggers a real charge or wallet credit.
 *
 * GET /api/stripe/debug
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isStripeConfigured } from "@/lib/stripe/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const report: Record<string, unknown> = {}

  // ── 1. Auth check ──────────────────────────────────────────────────────────
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

  // ── 2. Stripe env vars ───────────────────────────────────────────────────────
  const secretKey = process.env.STRIPE_SECRET_KEY ?? ""
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ""
  const secretKeyMode = secretKey.startsWith("sk_live_")
    ? "live"
    : secretKey.startsWith("sk_test_")
      ? "test"
      : secretKey
        ? "unrecognized format"
        : "not set"

  report.stripeEnvVars = {
    STRIPE_SECRET_KEY: isStripeConfigured() ? `set (${secretKeyMode} mode)` : "❌ NOT SET",
    STRIPE_WEBHOOK_SECRET: webhookSecret ? (webhookSecret.startsWith("whsec_") ? "set (looks valid)" : "set but doesn't start with whsec_ — check it was copied correctly") : "❌ NOT SET",
  }

  // ── 3. Has the wallet migration (020) been run? ──────────────────────────────
  const admin = createAdminClient()
  let migrationApplied = false
  try {
    const { data, error } = await admin.rpc("wallet_topup_fn_exists")
    if (error) {
      // Function itself missing means the migration was never run at all
      migrationApplied = false
    } else {
      migrationApplied = data === true
    }
  } catch {
    migrationApplied = false
  }
  report.wallet020MigrationApplied = migrationApplied
    ? "✅ credit_wallet_topup() exists — migration has been run"
    : "❌ credit_wallet_topup() NOT FOUND — run scripts/020_wallet_stripe_topup.sql in the Supabase SQL editor"

  // ── 4. Current wallet balance + recent transactions for this user ────────────
  try {
    const { data: walletRow } = await admin.from("wallet_balances").select("balance, updated_at").eq("user_id", userId).maybeSingle()
    report.currentBalance = walletRow ? Number(walletRow.balance) : 0
    report.balanceLastUpdated = walletRow?.updated_at ?? null

    const { data: recentTx } = await admin
      .from("wallet_transactions")
      .select("id, type, amount, description, stripe_session_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)
    report.recentTransactions = recentTx ?? []
  } catch (e: any) {
    report.walletQueryError = e?.message ?? String(e)
  }

  // ── 5. Any Stripe-sourced top-ups ever recorded (any user)? ──────────────────
  // If STRIPE_SECRET_KEY/WEBHOOK_SECRET are set and migration is applied but
  // this is still empty, the webhook is either not configured in the Stripe
  // Dashboard for the right mode, or events aren't reaching this deployment.
  try {
    const { count } = await admin
      .from("wallet_transactions")
      .select("id", { count: "exact", head: true })
      .not("stripe_session_id", "is", null)
    report.totalStripeWalletTopUpsEver = count ?? 0
  } catch (e: any) {
    report.stripeTopUpCountError = e?.message ?? String(e)
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  const envOk = isStripeConfigured() && !!webhookSecret
  report.diagnosis = {
    stripeEnvVars: envOk ? "✅ Both keys set" : "❌ MISSING — set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Vercel",
    migration: migrationApplied ? "✅ Applied" : "❌ NOT APPLIED — this alone would explain balance never updating",
    nextStep: !envOk
      ? "Add the missing Stripe env var(s) in Vercel and redeploy."
      : !migrationApplied
        ? "Run scripts/020_wallet_stripe_topup.sql in the Supabase SQL editor, then try a top-up again."
        : (report.totalStripeWalletTopUpsEver as number) === 0
          ? "Env vars set and migration applied, but ZERO Stripe top-ups have ever been recorded — check Stripe Dashboard → Developers → Webhooks → your endpoint → Recent deliveries. If it shows failed/no deliveries, the webhook endpoint's MODE (test vs live) doesn't match STRIPE_SECRET_KEY's mode, or the URL is wrong."
          : "Pipeline looks healthy. If a specific top-up didn't credit, check its stripe_session_id against Stripe Dashboard → Payments for that session's status.",
  }

  return NextResponse.json(report, { status: 200 })
}
