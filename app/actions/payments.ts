/**
 * app/actions/payments.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server actions for customer payments via Stripe Checkout.
 *
 * Flow:
 *   1. Customer clicks "Pay now" on a pending charge → createCheckoutSession()
 *   2. We find (or create) the payments row for the delivery, then create a
 *      Stripe Checkout Session and return its URL
 *   3. The client redirects to Stripe's hosted payment page
 *   4. Stripe calls /api/stripe/webhook (checkout.session.completed) which
 *      marks the payments row "paid" — the webhook is the source of truth
 *   5. Customer lands back on /dashboard/customer/payments?paid=1
 *
 * Until STRIPE_SECRET_KEY is configured this returns a friendly error and
 * the UI keeps working without payments.
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe, isStripeConfigured } from "@/lib/stripe/server"
import { getAppOrigin } from "@/lib/get-app-origin"

/**
 * Create a Stripe Checkout Session for a delivery's payment.
 * Returns { url } to redirect the customer to, or { error }.
 */
export async function createCheckoutSession(deliveryId: string): Promise<
  { url: string } | { error: string }
> {
  if (!isStripeConfigured()) {
    return { error: "Online payments are not enabled yet. Please check back soon." }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()

  // Verify the delivery exists and belongs to this customer
  const { data: delivery, error: deliveryError } = await admin
    .from("delivery_requests")
    .select("id, customer_id, price, tracking_number, pickup_address, delivery_address, status")
    .eq("id", deliveryId)
    .single()

  if (deliveryError || !delivery) return { error: "Delivery not found" }
  if (delivery.customer_id !== user.id) return { error: "This delivery does not belong to you" }
  if (delivery.status === "cancelled") return { error: "This delivery was cancelled" }

  const amount = Number(delivery.price ?? 0)
  if (!amount || amount <= 0) return { error: "This delivery has no charge to pay" }

  // Find or create the payments row (orders created via the modal have none)
  let { data: payment } = await admin
    .from("payments")
    .select("id, status")
    .eq("delivery_id", deliveryId)
    .maybeSingle()

  if (payment && (payment.status === "paid" || payment.status === "released")) {
    return { error: "This delivery has already been paid" }
  }

  if (!payment) {
    const { data: created, error: createError } = await admin
      .from("payments")
      .insert({ delivery_id: deliveryId, amount, status: "pending" })
      .select("id, status")
      .single()
    if (createError || !created) {
      console.error("[Payments] Failed to create payment row:", createError)
      return { error: "Could not prepare the payment. Please try again." }
    }
    payment = created
  }

  try {
    const stripe = getStripe()
    const origin = await getAppOrigin()

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(amount * 100), // pence
            product_data: {
              name: `Go Drop delivery ${delivery.tracking_number ?? ""}`.trim(),
              description: `${delivery.pickup_address} → ${delivery.delivery_address}`.slice(0, 500),
            },
          },
          quantity: 1,
        },
      ],
      // The webhook uses this metadata to mark the right payment row paid
      metadata: {
        type: "delivery_payment",
        payment_id: payment.id,
        delivery_id: deliveryId,
        user_id: user.id,
      },
      success_url: `${origin}/dashboard/customer/payments?paid=1`,
      cancel_url: `${origin}/dashboard/customer/payments?canceled=1`,
    })

    if (!session.url) return { error: "Stripe did not return a checkout URL" }

    // Record the session id so the webhook (and support) can reconcile
    await admin
      .from("payments")
      .update({ stripe_session_id: session.id })
      .eq("id", payment.id)

    return { url: session.url }
  } catch (error) {
    console.error("[Payments] createCheckoutSession failed:", error)
    return { error: "Payment could not be started. Please try again." }
  }
}

// Closed set of valid return destinations — never accept a raw path/URL from
// the client here, that would be an open-redirect vector through Stripe.
const TOPUP_RETURN_PATHS = {
  wallet: "/dashboard/customer/wallet",
  "new-delivery": "/dashboard/customer?resume_delivery=1",
} as const
export type TopUpReturnTo = keyof typeof TOPUP_RETURN_PATHS

/**
 * Create a Stripe Checkout Session to top up the customer's wallet.
 * The wallet balance is credited by the webhook on checkout.session.completed
 * — never client-side — so a customer can't fake a top-up.
 *
 * @param returnTo Where to land after Stripe redirects back — "wallet" (the
 *   normal top-up flow) or "new-delivery" (resumes an in-progress delivery
 *   request that was paused to top up; see NewDeliveryModal).
 */
export async function createWalletTopUpSession(
  amount: number,
  returnTo: TopUpReturnTo = "wallet"
): Promise<
  { url: string } | { error: string }
> {
  if (!isStripeConfigured()) {
    return { error: "Online payments are not enabled yet. Please check back soon." }
  }
  if (!Number.isFinite(amount) || amount < 1 || amount > 500) {
    return { error: "Amount must be between £1 and £500" }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  try {
    const stripe = getStripe()
    const origin = await getAppOrigin()
    const roundedAmount = Math.round(amount * 100) / 100

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(roundedAmount * 100), // pence
            product_data: {
              name: "Go Drop Wallet Top-Up",
              description: `Add £${roundedAmount.toFixed(2)} to your Go Drop wallet`,
            },
          },
          quantity: 1,
        },
      ],
      // The webhook uses this metadata to credit the right wallet — the
      // amount is carried in metadata (not re-derived from the session
      // total) so a currency/rounding mismatch can never happen.
      metadata: {
        type: "wallet_topup",
        user_id: user.id,
        amount: roundedAmount.toFixed(2),
      },
      success_url: `${origin}${TOPUP_RETURN_PATHS[returnTo]}${TOPUP_RETURN_PATHS[returnTo].includes("?") ? "&" : "?"}topup=1`,
      cancel_url: `${origin}/dashboard/customer/wallet?canceled=1`,
    })

    if (!session.url) return { error: "Stripe did not return a checkout URL" }
    return { url: session.url }
  } catch (error) {
    console.error("[Payments] createWalletTopUpSession failed:", error)
    return { error: "Payment could not be started. Please try again." }
  }
}
