import 'server-only'
import { getStripe } from '@/lib/stripe/server'
export async function refundUnusedShopping(
  orderId: string,
  refund: number,
  payment: {
    stripe_payment_intent: string | null
    additional_payments?: { intent: string; amount: number }[]
  },
) {
  let remaining = Math.round(refund * 100)
  const sources = [...(payment.additional_payments ?? [])]
    .reverse()
    .map((p) => ({
      intent: p.intent,
      limit: Math.round(Number(p.amount) * 100),
    }))
  if (payment.stripe_payment_intent)
    sources.push({ intent: payment.stripe_payment_intent, limit: remaining })
  for (const source of sources) {
    if (remaining <= 0) break
    const amount = Math.min(remaining, source.limit)
    if (amount > 0)
      await getStripe().refunds.create(
        { payment_intent: source.intent, amount },
        { idempotencyKey: `receipt-refund-${orderId}-${source.intent}` },
      )
    remaining -= amount
  }
  if (remaining > 0)
    throw new Error(
      'Shopping refund cannot be allocated to the original payments',
    )
}
