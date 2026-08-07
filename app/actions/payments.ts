/**
 * app/actions/payments.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server actions for customer wallet top-ups via Stripe Checkout.
 *
 * There is no "pay for a delivery afterward" flow — every delivery is paid
 * atomically at creation time from the customer's wallet (see
 * createDeliveryRequest() / create_delivery_with_wallet_payment(), and
 * scripts/026_payment_before_dispatch.sql, which closes the RLS gap that
 * used to let an unpaid delivery exist). If a customer's balance is too
 * low, they top up their wallet here first, then resume the delivery.
 *
 * Until STRIPE_SECRET_KEY is configured this returns a friendly error and
 * the UI keeps working without payments.
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { getStripe, isStripeConfigured } from "@/lib/stripe/server"
import { getAppOrigin } from "@/lib/get-app-origin"

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
