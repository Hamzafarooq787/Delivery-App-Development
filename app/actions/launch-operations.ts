'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/server'
import { runWeeklyPayouts } from '@/lib/weekly-payouts'
async function adminUser() {
  const client = await createClient(),
    {
      data: { user },
    } = await client.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const admin = createAdminClient(),
    { data } = await admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
  if (data?.role !== 'admin') throw new Error('Not authorised')
  return user
}
export async function processWeeklyLaunchPayouts() {
  try {
    await adminUser()
    if (process.env.GODROP_WEEKLY_PAYOUTS_ENABLED !== 'true')
      return { error: 'Payouts await Stripe test verification' }
    return await runWeeklyPayouts()
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Payout run failed' }
  }
}
export async function recordShoppingFunding(
  deliveryId: string,
  reference: string,
) {
  try {
    await adminUser()
    if (!reference.trim() || reference.length > 150)
      throw new Error('Enter a verified platform purchase-card reference')
    const admin = createAdminClient()
    const { data: order } = await admin
      .from('delivery_requests')
      .select('service_type,launch_quote,driver_id')
      .eq('id', deliveryId)
      .single()
    if (!order?.launch_quote || order.service_type !== 'buy_for_me')
      throw new Error('Not a direct shopping booking')
    if (
      process.env.GODROP_SHOPPING_FUNDING_READY !== 'true' ||
      !process.env.STRIPE_ISSUING_WEBHOOK_SECRET
    )
      throw new Error(
        'Funded Issuing and its verified authorization webhook are required',
      )
    const card = await getStripe().issuing.cards.retrieve(reference.trim())
    if (
      card.status !== 'active' ||
      card.metadata?.driver_id !== order.driver_id
    )
      throw new Error(
        'Use the active GoDrop card belonging to the assigned driver',
      )
    const { data: other } = await admin
      .from('payments')
      .select('delivery_id,delivery_requests!inner(status)')
      .eq('funding_reference', card.id)
      .in('delivery_requests.status', ['accepted', 'collected', 'in_transit'])
    if (other?.some((p) => p.delivery_id !== deliveryId))
      throw new Error('This card is already funding another active job')
    await getStripe().issuing.cards.update(card.id, {
      metadata: { active_delivery_id: deliveryId },
    })
    const { data, error } = await admin
      .from('payments')
      .update({ funding_reference: card.id })
      .eq('delivery_id', deliveryId)
      .eq('status', 'paid')
      .select('id')
      .single()
    if (error || !data) throw new Error('Could not record purchase funding')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Funding update failed' }
  }
}
export async function reportShoppingProblem(
  deliveryId: string,
  problem: string,
) {
  const client = await createClient(),
    {
      data: { user },
    } = await client.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const admin = createAdminClient(),
    { data: d } = await admin
      .from('delivery_requests')
      .select('driver_id,service_type')
      .eq('id', deliveryId)
      .single()
  if (d?.driver_id !== user.id || d.service_type !== 'buy_for_me')
    return { error: 'Not your shopping job' }
  if (!problem.trim() || problem.length > 1000)
    return { error: 'Describe the problem in 1–1000 characters' }
  const { error } = await admin
    .from('support_tickets')
    .insert({
      user_id: user.id,
      subject: `Shopping problem: ${deliveryId}`,
      message: problem,
      status: 'open',
    })
  return error ? { error: 'Could not report problem' } : { success: true }
}
export async function recordShoppingUnitPrice(
  itemId: string,
  unitPrice: number,
) {
  const client = await createClient(),
    {
      data: { user },
    } = await client.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100)
    return { error: 'Enter a valid unit price' }
  const admin = createAdminClient(),
    { data: item } = await admin
      .from('shopping_items')
      .select('id,name,delivery_id,estimated_price,quantity')
      .eq('id', itemId)
      .single()
  if (!item) return { error: 'Item not found' }
  const { data: d } = await admin
    .from('delivery_requests')
    .select('driver_id,launch_quote,max_spend_approved')
    .eq('id', item.delivery_id)
    .single()
  if (d?.driver_id !== user.id || !d.launch_quote)
    return { error: 'Not your launch shopping job' }
  if (unitPrice * item.quantity > 100)
    return {
      error:
        'This exceeds the funded budget. Do not purchase; report the problem to support.',
    }
  const { error } = await admin
    .from('shopping_items')
    .update({ found_unit_price: unitPrice })
    .eq('id', itemId)
  if (error) return { error: 'Could not save the unit price' }
  if (unitPrice > Number(item.estimated_price ?? 0)) {
    const { requestSubstitution } = await import('./shopping')
    return requestSubstitution({
      shopping_item_id: item.id,
      delivery_id: item.delivery_id,
      suggested_name: item.name,
      suggested_price: unitPrice,
      driver_notes:
        'Higher shelf price. Customer approval required before purchase.',
    })
  }
  return { success: true }
}
