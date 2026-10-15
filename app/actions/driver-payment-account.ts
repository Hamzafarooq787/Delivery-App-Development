'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/server'
import { readLaunchSettings } from '@/lib/launch-settings'
import { getAppOrigin } from '@/lib/get-app-origin'
export async function startDriverPaymentOnboarding(agreed: boolean) {
  if (agreed !== true)
    return { error: 'Read and accept the driver fee agreement' }
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
  if (profile?.role !== 'driver') return { error: 'Driver account required' }
  try {
    const { data: driver, error } = await admin
      .from('driver_profiles')
      .select('stripe_connect_account_id')
      .eq('id', user.id)
      .single()
    if (error || !driver)
      throw new Error('Payment onboarding database is not ready')
    const rates = await readLaunchSettings()
    const { error: agreementError } = await admin
      .from('driver_profiles')
      .update({
        launch_agreement: {
          commissionPercent: rates.commissionPercent,
          minimumDriverDelivery: rates.minimumDriverDelivery,
          minimumDriverShopping: rates.minimumDriverShopping,
          acceptedAt: new Date().toISOString(),
        },
      })
      .eq('id', user.id)
    if (agreementError) throw new Error('Could not save your fee agreement')
    const stripe = getStripe()
    let id = driver.stripe_connect_account_id
    if (!id) {
      const account = await stripe.accounts.create(
        {
          country: 'GB',
          controller: {
            fees: { payer: 'application' },
            losses: { payments: 'application' },
            stripe_dashboard: { type: 'express' },
          },
          settings: {
            payouts: {
              schedule: { interval: 'weekly', weekly_anchor: 'monday' },
            },
          },
          email: user.email,
          capabilities: { transfers: { requested: true } },
          metadata: { driver_id: user.id },
        },
        { idempotencyKey: `driver-account-${user.id}` },
      )
      id = account.id
      const { error: saveError } = await admin
        .from('driver_profiles')
        .update({ stripe_connect_account_id: id })
        .eq('id', user.id)
      if (saveError) throw new Error('Could not save payment account')
    }
    const origin = await getAppOrigin()
    const link = await stripe.accountLinks.create({
      account: id,
      type: 'account_onboarding',
      refresh_url: `${origin}/dashboard/driver/payouts`,
      return_url: `${origin}/dashboard/driver/payouts`,
    })
    return { url: link.url }
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : 'Could not start driver payment onboarding',
    }
  }
}
