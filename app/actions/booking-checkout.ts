'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, isStripeConfigured } from '@/lib/stripe/server'
import { getAppOrigin } from '@/lib/get-app-origin'
import { readLaunchSettings } from '@/lib/launch-settings'
import {
  driverShare,
  roundMoney,
  validateShoppingItems,
} from '@/lib/launch-pricing'
import { getDeliveryQuote } from './pricing'
import type { CreateDeliveryParams } from './delivery'
import type { CreateShoppingRequestParams } from './shopping'
export type BookingInput =
  | { service: 'delivery'; details: CreateDeliveryParams }
  | { service: 'shopping'; details: CreateShoppingRequestParams }
export async function startBookingCheckout(
  input: BookingInput,
): Promise<{ url: string } | { error: string }> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'customer')
    return { error: 'Customer account required' }
  try {
    if (process.env.GODROP_LAUNCH_VERIFIED !== 'true') return {error:'Direct checkout is awaiting end-to-end launch verification. No payment has been taken.'}
    const settings = await readLaunchSettings()
    const shopping = input.service === 'shopping'
    if (
      !(shopping
        ? settings.shoppingCheckoutEnabled
        : settings.deliveryCheckoutEnabled)
    )
      return {
        error:
          'Direct checkout is awaiting launch verification. No payment has been taken.',
      }
    if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET)
      return { error: 'Payments are unavailable' }
    const { data: ready, error: readyError } = await admin.rpc(
      'godrop_launch_ready',
    )
    if (readyError || ready !== true)
      return {
        error: 'The payment database needs the reviewed launch migration',
      }
    if (shopping && process.env.GODROP_SHOPPING_FUNDING_READY !== 'true')
      return { error: 'GoDrop-funded shopping purchases are not enabled' }
    let booking: Record<string, unknown>,
      shoppingFunds = 0
    if (input.service === 'shopping') {
      const d = input.details
      shoppingFunds = validateShoppingItems(d.shopping_items, settings)
      if (
        !d.shop_name?.trim() ||
        !d.shop_address?.trim() ||
        !d.delivery_address?.trim()
      )
        throw new Error('Enter shop and delivery details')
      booking = {
        service: 'shopping',
        pickup_address: d.shop_address,
        pickup_lat: d.shop_lat,
        pickup_lng: d.shop_lng,
        delivery_address: d.delivery_address,
        delivery_lat: d.delivery_lat,
        delivery_lng: d.delivery_lng,
        shop_name: d.shop_name,
        shop_instructions: d.shop_instructions,
        item_description: d.shopping_items
          .map((i) => `${i.quantity}× ${i.name}`)
          .join(', '),
        package_size: 'medium',
        items: d.shopping_items,
      }
    } else {
      booking = { ...input.details, service: 'delivery' }
      if (
        !input.details.pickup_address?.trim() ||
        !input.details.delivery_address?.trim()
      )
        throw new Error('Select collection and delivery addresses')
    }
    const q = await getDeliveryQuote({
      pickupLat: Number(booking.pickup_lat),
      pickupLng: Number(booking.pickup_lng),
      deliveryLat: Number(booking.delivery_lat),
      deliveryLng: Number(booking.delivery_lng),
      packageSize: booking.package_size as 'medium',
      promoCode: input.details.promo_code,
    })
    if ('error' in q) return { error: q.error }
    const shoppingFee = shopping ? settings.shoppingFee : 0,
      serviceFees = roundMoney(q.data.finalPrice + shoppingFee),
      share = driverShare(serviceFees, shopping, settings),
      totalCharge = roundMoney(serviceFees + shoppingFunds)
    const quote = {
      ...q.data,
      durationMin:
        q.data.durationMin + (shopping ? settings.shoppingEstimateMinutes : 0),
      serviceFees,
      shoppingFee,
      shoppingFunds,
      totalCharge,
      driverAmount: share.amount,
      commissionAmount: share.commission,
      subsidyAmount: share.subsidy,
      commissionPercent: settings.commissionPercent,
      freeWaitingMinutes: settings.freeWaitingMinutes,
      waitingPerMinute: settings.waitingPerMinute,
      promoCode: q.data.promoCodeText,
    }
    const { data: id, error } = await admin.rpc('create_launch_booking', {
      p_customer: user.id,
      p_booking: booking,
      p_quote: quote,
    })
    if (error || !id)
      throw new Error(
        'Could not prepare this booking. No payment has been taken.',
      )
    const origin = await getAppOrigin(),
      stripe = getStripe()
    const lines = [
      {
        price_data: {
          currency: 'gbp',
          unit_amount: Math.round(q.data.finalPrice * 100),
          product_data: { name: 'GoDrop delivery' },
        },
        quantity: 1,
      },
    ]
    if (shoppingFee)
      lines.push({
        price_data: {
          currency: 'gbp',
          unit_amount: Math.round(shoppingFee * 100),
          product_data: { name: 'GoDrop shopping service' },
        },
        quantity: 1,
      })
    if (shoppingFunds)
      lines.push({
        price_data: {
          currency: 'gbp',
          unit_amount: Math.round(shoppingFunds * 100),
          product_data: {
            name: 'Shopping purchase funds — unused money refunded',
          },
        },
        quantity: 1,
      })
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: user.email,
        line_items: lines,
        metadata: {
          type: 'booking',
          delivery_id: String(id),
          customer_id: user.id,
        },
        payment_intent_data: {
          metadata: { delivery_id: String(id), type: 'booking' },
        },
        success_url: `${origin}/dashboard/customer/booking-confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/dashboard/customer/booking-confirmation?cancelled=${id}`,
      },
      { idempotencyKey: `booking-checkout-${id}` },
    )
    const { error: attachError } = await admin
      .from('payments')
      .update({ stripe_session_id: session.id })
      .eq('delivery_id', id)
      .eq('status', 'pending')
    if (attachError || !session.url) {
      await stripe.checkout.sessions.expire(session.id).catch(() => {})
      throw new Error('Could not start payment. Please try again.')
    }
    return { url: session.url }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Payment could not be started',
    }
  }
}
export async function cancelDirectBooking(id: string) {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const admin = createAdminClient()
  const { data: d } = await admin
    .from('delivery_requests')
    .select('id,customer_id,status,driver_id,launch_quote')
    .eq('id', id)
    .single()
  if (!d || d.customer_id !== user.id || !d.launch_quote)
    return { error: 'Booking not found' }
  if (d.driver_id || !['requested', 'cancelled'].includes(d.status))
    return {
      error: 'Contact support to cancel a job already accepted by a driver',
    }
  const { data: p, error: reserveError } = await admin.rpc(
    'reserve_launch_cancellation',
    { p_delivery: id, p_customer: user.id },
  )
  if (reserveError || !p)
    return {
      error:
        'Cancellation is unavailable. The driver may have accepted this job.',
    }
  try {
    const stripe = getStripe()
    if (p.status === 'pending' && p.stripe_session_id)
      await stripe.checkout.sessions.expire(p.stripe_session_id)
    if (p.stripe_payment_intent && p.refunded_amount < p.amount) {
      await stripe.refunds.create(
        { payment_intent: p.stripe_payment_intent },
        { idempotencyKey: `cancel-booking-${id}` },
      )
      await admin
        .from('payments')
        .update({ refunded_amount: p.amount })
        .eq('id', p.id)
    }
    await admin
      .from('delivery_requests')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .is('driver_id', null)
    return { success: true }
  } catch {
    return {
      error: 'Cancellation could not be confirmed. Please contact support.',
    }
  }
}
