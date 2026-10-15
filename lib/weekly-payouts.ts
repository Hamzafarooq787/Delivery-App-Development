import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/server'
export async function runWeeklyPayouts() {
  const admin = createAdminClient(),
    stripe = getStripe()
  const { error } = await admin.rpc('prepare_weekly_driver_payouts', {
    p_before: new Date().toISOString(),
  })
  if (error) throw new Error('Could not prepare payout batches')
  const { data: sent } = await admin
    .from('payouts')
    .select('id')
    .eq('status', 'paid')
    .not('stripe_transfer_id', 'is', null)
  if (sent?.length) {
    const { error: reconcileError } = await admin
      .from('driver_earnings')
      .update({ status: 'paid' })
      .in(
        'payout_id',
        sent.map((p) => p.id),
      )
    if (reconcileError) throw new Error('Prior payout reconciliation failed')
  }
  const { data: rows, error: queryError } = await admin
    .from('payouts')
    .select('id,driver_id,amount')
    .eq('status', 'pending')
    .is('stripe_transfer_id', null)
    .is('transfer_attempted_at', null)
  if (queryError) throw new Error('Could not load payout batches')
  let paid = 0,
    blocked = 0
  for (const row of rows ?? []) {
    try {
      const { data: driver } = await admin
        .from('driver_profiles')
        .select('stripe_connect_account_id')
        .eq('id', row.driver_id)
        .single()
      if (!driver?.stripe_connect_account_id)
        throw new Error('Driver Stripe onboarding is incomplete')
      const account = await stripe.accounts.retrieve(
        driver.stripe_connect_account_id,
      )
      if (account.capabilities?.transfers !== 'active')
        throw new Error('Driver transfer capability is inactive')
      // Claim before contacting Stripe. An uncertain external response must never
      // be retried automatically after Stripe's idempotency retention window.
      const { data: claim, error: claimError } = await admin
        .from('payouts')
        .update({
          transfer_attempted_at: new Date().toISOString(),
          failure_reason:
            'Transfer attempt started; reconcile with Stripe before any manual retry',
        })
        .eq('id', row.id)
        .eq('status', 'pending')
        .is('transfer_attempted_at', null)
        .select('id')
        .maybeSingle()
      if (claimError) throw new Error('Could not reserve this transfer')
      if (!claim) continue
      const transfer = await stripe.transfers.create(
        {
          amount: Math.round(Number(row.amount) * 100),
          currency: 'gbp',
          destination: account.id,
          metadata: { payout_id: row.id, driver_id: row.driver_id },
        },
        { idempotencyKey: `weekly-driver-payout-${row.id}` },
      )
      const { error: paidError } = await admin
        .from('payouts')
        .update({
          status: 'paid',
          stripe_transfer_id: transfer.id,
          paid_at: new Date().toISOString(),
          failure_reason: null,
        })
        .eq('id', row.id)
      if (paidError)
        throw new Error(
          'Transfer succeeded; database reconciliation needs retry',
        )
      const { error: earnError } = await admin
        .from('driver_earnings')
        .update({ status: 'paid' })
        .eq('payout_id', row.id)
      if (earnError) throw new Error('Earnings reconciliation needs retry')
      paid++
    } catch (e) {
      blocked++
      await admin
        .from('payouts')
        .update({
          failure_reason: e instanceof Error ? e.message : 'Payout failed',
        })
        .eq('id', row.id)
    }
  }
  return { paid, blocked }
}
