/**
 * lib/stripe/server.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Stripe server-side SDK initialisation.
 *
 * ⚠️  SERVER-SIDE ONLY — never import in client components.
 *
 * Required environment variables (add to Vercel project settings):
 *   STRIPE_SECRET_KEY      — sk_test_... / sk_live_...  (Dashboard → Developers → API keys)
 *   STRIPE_WEBHOOK_SECRET  — whsec_...                  (Dashboard → Developers → Webhooks)
 *
 * Until the keys are configured, isStripeConfigured() returns false and
 * getStripe() throws — callers surface a friendly "payments not enabled yet"
 * message instead of crashing.
 */

import Stripe from "stripe"

let stripeInstance: Stripe | null = null

/** True when STRIPE_SECRET_KEY is present (payments can be attempted). */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

/**
 * Returns the singleton Stripe client.
 * Throws when STRIPE_SECRET_KEY is missing — guard with isStripeConfigured().
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error(
        "[Stripe] STRIPE_SECRET_KEY is not set — add it to the environment before using payments."
      )
    }
    stripeInstance = new Stripe(key)
  }
  return stripeInstance
}
