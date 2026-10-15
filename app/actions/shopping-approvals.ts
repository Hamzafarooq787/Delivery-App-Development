'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/server'
import { getAppOrigin } from '@/lib/get-app-origin'
import { readLaunchSettings } from '@/lib/launch-settings'
import { respondToSubstitution } from './shopping'
export async function getCustomerShoppingApprovals(deliveryId: string) {
  const client = await createClient(),
    {
      data: { user },
    } = await client.auth.getUser()
  if (!user) return { data: [], error: 'Not authenticated' }
  const admin = createAdminClient(),
    { data: d } = await admin
      .from('delivery_requests')
      .select('customer_id')
      .eq('id', deliveryId)
      .single()
  if (d?.customer_id !== user.id) return { data: [], error: 'Not your order' }
  const { data, error } = await admin
    .from('shopping_substitutions')
    .select(
      'id,shopping_item_id,suggested_name,suggested_price,driver_notes,photo_url,customer_approved',
    )
    .eq('delivery_id', deliveryId)
    .is('customer_approved', null)
  return {
    data: data ?? [],
    error: error ? 'Could not load approval requests' : null,
  }
}
export async function approveCustomerShoppingChange(substitutionId: string) {
  const client = await createClient(),
    {
      data: { user },
    } = await client.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('shopping_substitutions')
    .select('*')
    .eq('id', substitutionId)
    .single()
  if (!sub || sub.customer_approved != null)
    return { error: 'This request has already been answered' }
  const { data: d } = await admin
    .from('delivery_requests')
    .select('id,customer_id,launch_quote,max_spend_approved,status')
    .eq('id', sub.delivery_id)
    .single()
  if (
    !d ||
    d.customer_id !== user.id ||
    ['cancelled', 'delivered'].includes(d.status)
  )
    return { error: 'Not an active order' }
  if (!d.launch_quote) return respondToSubstitution(substitutionId, true)
  const { data: items } = await admin
    .from('shopping_items')
    .select('id,quantity,estimated_price,found_unit_price,status')
    .eq('delivery_id', d.id)
  const projected = (items ?? [])
    .filter((i) => i.status !== 'unavailable')
    .reduce(
      (sum, i) =>
        sum +
        Number(
          i.id === sub.shopping_item_id
            ? sub.suggested_price
            : (i.found_unit_price ?? i.estimated_price ?? 0),
        ) *
          i.quantity,
      0,
    )
  const settings = await readLaunchSettings()
  if (!Number.isFinite(projected) || projected > settings.maxShoppingValue)
    return {
      error: `This change exceeds the £${settings.maxShoppingValue} shopping limit`,
    }
  const extra =
    Math.round(Math.max(0, projected - Number(d.max_spend_approved)) * 100) /
    100
  if (extra <= 0) return respondToSubstitution(substitutionId, true)
  try {
    const origin = await getAppOrigin()
    const session = await getStripe().checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: user.email,
        line_items: [
          {
            price_data: {
              currency: 'gbp',
              unit_amount: Math.round(extra * 100),
              product_data: {
                name: 'Additional shopping purchase funds',
                description: `Approve ${sub.suggested_name}; unused funds are refunded`,
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          type: 'shopping_budget',
          delivery_id: d.id,
          substitution_id: substitutionId,
          customer_id: user.id,
          amount: extra.toFixed(2),
        },
        success_url: `${origin}/dashboard/customer/tracking?id=${d.id}`,
        cancel_url: `${origin}/dashboard/customer/tracking?id=${d.id}`,
      },
      {
        idempotencyKey: `shopping-approval-${substitutionId}-${Math.round(extra * 100)}`,
      },
    )
    return session.url
      ? { url: session.url }
      : { error: 'Could not start the approval payment' }
  } catch {
    return { error: 'Could not start the approval payment' }
  }
}
