import 'server-only'
import { getStripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUser } from '@/app/actions/notifications'
export async function fulfillShoppingBudget(sessionId: string) {
  const stripe = getStripe(),
    s = await stripe.checkout.sessions.retrieve(sessionId)
  if (
    s.metadata?.type !== 'shopping_budget' ||
    s.payment_status !== 'paid' ||
    s.currency !== 'gbp'
  )
    throw new Error('Shopping payment not confirmed')
  const amount = Number(s.metadata.amount)
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    s.amount_total !== Math.round(amount * 100)
  )
    throw new Error('Shopping payment amount mismatch')
  const intent =
    typeof s.payment_intent === 'string'
      ? s.payment_intent
      : s.payment_intent?.id
  if (!intent) throw new Error('Payment intent missing')
  const admin = createAdminClient()
  const { data: credited, error } = await admin.rpc('confirm_shopping_budget', {
    p_delivery: s.metadata.delivery_id,
    p_substitution: s.metadata.substitution_id,
    p_customer: s.metadata.customer_id,
    p_session: s.id,
    p_intent: intent,
    p_amount: amount,
  })
  if (error) {
    if (
      /approval_already_answered|shopping_limit_exceeded|invalid_budget_payment/.test(
        error.message,
      )
    ) {
      await stripe.refunds.create(
        { payment_intent: intent },
        { idempotencyKey: `unused-approval-${s.id}` },
      )
      return
    }
    throw new Error('Shopping budget reconciliation needs retry')
  }
  if (credited) {
    const { data: d } = await admin
      .from('delivery_requests')
      .select('driver_id')
      .eq('id', s.metadata.delivery_id)
      .single()
    if (d?.driver_id)
      void notifyUser({
        userId: d.driver_id,
        title: 'Shopping change approved',
        body: 'The customer approved and paid for the shopping change. Check the funded budget before purchasing.',
        url: `/dashboard/driver/jobs/${s.metadata.delivery_id}`,
        tag: `shopping-budget-${s.id}`,
      }).catch(console.error)
  }
}
