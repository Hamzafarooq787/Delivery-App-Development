import 'server-only'
import { getStripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyDriversOfNewDelivery } from '@/app/actions/notifications'
export async function fulfillBooking(sessionId: string) {
  const stripe = getStripe(),
    session = await stripe.checkout.sessions.retrieve(sessionId)
  if (
    session.metadata?.type !== 'booking' ||
    session.currency !== 'gbp' ||
    session.payment_status !== 'paid' ||
    !session.metadata.delivery_id ||
    !session.metadata.customer_id
  )
    throw new Error('Payment not confirmed')
  const intent =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id
  if (!intent) throw new Error('Payment intent missing')
  const admin = createAdminClient()
  const { data: order, error: orderError } = await admin
    .from('delivery_requests')
    .select('id,customer_id,tracking_number,status,pickup_address,package_size')
    .eq('id', session.metadata.delivery_id)
    .single()
  if (
    orderError ||
    !order ||
    order.customer_id !== session.metadata.customer_id
  )
    throw new Error('Booking not found')
  if (order.status === 'cancelled') {
    await stripe.refunds.create(
      { payment_intent: intent },
      { idempotencyKey: `cancel-booking-${order.id}` },
    )
    const { error: refundError } = await admin
      .from('payments')
      .update({
        stripe_payment_intent: intent,
        refunded_amount: Number(session.amount_total ?? 0) / 100,
      })
      .eq('delivery_id', order.id)
    if (refundError) throw new Error('Refund reconciliation needs retry')
    return order
  }
  const { data: confirmed, error } = await admin.rpc('confirm_launch_payment', {
    p_delivery: order.id,
    p_session: session.id,
    p_intent: intent,
    p_pence: session.amount_total,
  })
  if (error) throw new Error('Could not confirm booking payment')
  try {
    const pi = await stripe.paymentIntents.retrieve(intent, {
      expand: ['latest_charge.balance_transaction'],
    })
    const charge = pi.latest_charge
    if (
      charge &&
      typeof charge !== 'string' &&
      charge.balance_transaction &&
      typeof charge.balance_transaction !== 'string'
    )
      await admin
        .from('payments')
        .update({ processing_cost: charge.balance_transaction.fee / 100 })
        .eq('delivery_id', order.id)
  } catch {
    /* Processing fees may not yet be available; admin shows pending instead of zero. */
  }
  if (confirmed) {
    void notifyDriversOfNewDelivery(
      order.id,
      order.pickup_address,
      order.package_size,
    ).catch(console.error)
  }
  return order
}
