/**
 * app/api/stripe/webhook/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Stripe webhook endpoint — the source of truth for payment completion.
 *
 * Configure in Stripe Dashboard → Developers → Webhooks:
 *   URL:    https://<your-domain>/api/stripe/webhook
 *   Events: checkout.session.completed, checkout.session.expired,
 *           payment_intent.payment_failed
 *   Then copy the signing secret into STRIPE_WEBHOOK_SECRET.
 *
 * Handled events:
 *   checkout.session.completed
 *     metadata.type === "delivery_payment" → payments.status = "paid" (+ intent id, paid_at)
 *     metadata.type === "wallet_topup"     → credits wallet_balances (idempotent — see below)
 *   payment_intent.payment_failed → payments.status = "failed"
 *
 * Signature verification requires the RAW request body — do not parse JSON
 * before verifying.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe, isStripeConfigured } from "@/lib/stripe/server"
import { notifyUser } from "@/app/actions/notifications"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  const rawBody = await request.text()

  let event
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object
        const metadataType = session.metadata?.type

        if (metadataType === "wallet_topup") {
          const userId = session.metadata?.user_id
          const amount = Number(session.metadata?.amount ?? 0)

          if (!userId || !amount || amount <= 0) {
            console.error("[Stripe Webhook] wallet_topup missing/invalid metadata:", session.metadata)
            break
          }

          // Idempotency: insert the transaction row first under a unique
          // constraint on stripe_session_id. If Stripe redelivers this event,
          // the insert fails and we skip crediting the balance a second time.
          const { error: insertError } = await admin.from("wallet_transactions").insert({
            user_id: userId,
            type: "topup",
            amount,
            description: `Wallet top-up of £${amount.toFixed(2)} via Stripe`,
            stripe_session_id: session.id,
          })

          if (insertError) {
            if (insertError.code === "23505") {
              // Unique violation — already processed this session, ignore.
              console.log(`[Stripe Webhook] wallet_topup session ${session.id} already processed`)
              break
            }
            console.error("[Stripe Webhook] Failed to log wallet top-up transaction:", insertError)
            return NextResponse.json({ error: "DB insert failed" }, { status: 500 })
          }

          const { error: rpcError } = await admin.rpc("increment_wallet_balance", {
            p_user_id: userId,
            p_amount: amount,
          })

          if (rpcError) {
            console.error("[Stripe Webhook] Failed to credit wallet balance:", rpcError)
            return NextResponse.json({ error: "Balance update failed" }, { status: 500 })
          }

          console.log(`[Stripe Webhook] Wallet topped up £${amount.toFixed(2)} for user ${userId}`)

          notifyUser({
            userId,
            title: "✅ Wallet topped up",
            body: `£${amount.toFixed(2)} has been added to your Go Drop wallet.`,
            url: "/dashboard/customer/wallet",
            tag: `wallet-topup-${session.id}`,
          }).catch((err) => console.error("[Stripe Webhook] Top-up notification failed:", err))

          break
        }

        // Default: delivery payment
        const paymentId = session.metadata?.payment_id
        const deliveryId = session.metadata?.delivery_id
        const userId = session.metadata?.user_id

        if (!paymentId) {
          console.error("[Stripe Webhook] checkout.session.completed missing payment_id metadata")
          break
        }

        const { error } = await admin
          .from("payments")
          .update({
            status: "paid",
            stripe_payment_intent:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id ?? null,
            paid_at: new Date().toISOString(),
          })
          .eq("id", paymentId)

        if (error) {
          console.error("[Stripe Webhook] Failed to mark payment paid:", error)
          // Return 500 so Stripe retries the delivery
          return NextResponse.json({ error: "DB update failed" }, { status: 500 })
        }

        console.log(`[Stripe Webhook] Payment ${paymentId} marked paid (delivery ${deliveryId})`)

        if (userId) {
          notifyUser({
            userId,
            title: "✅ Payment received",
            body: "Thanks! Your delivery payment was processed successfully.",
            url: "/dashboard/customer/payments",
            tag: `payment-paid-${paymentId}`,
          }).catch((err) => console.error("[Stripe Webhook] Payment notification failed:", err))
        }
        break
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object
        const { error } = await admin
          .from("payments")
          .update({ status: "failed" })
          .eq("stripe_payment_intent", intent.id)
        if (error) console.error("[Stripe Webhook] Failed to mark payment failed:", error)
        break
      }

      default:
        // Unhandled event type — acknowledge so Stripe doesn't retry
        break
    }
  } catch (err) {
    console.error("[Stripe Webhook] Handler error:", err)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
