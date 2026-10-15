'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readLaunchSettings, writeLaunchSettings } from '@/lib/launch-settings'
import { validateLaunchSettings } from '@/lib/launch-pricing'
import { isStripeConfigured } from '@/lib/stripe/server'
export async function getLaunchSettings() {
  return readLaunchSettings()
}
export async function saveLaunchSettings(value: unknown) {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (data?.role !== 'admin') return { error: 'Not authorised' }
  try {
    const settings = validateLaunchSettings(value)
    if ((settings.deliveryCheckoutEnabled || settings.shoppingCheckoutEnabled) && process.env.GODROP_LAUNCH_VERIFIED !== 'true') throw new Error('Complete the launch review and end-to-end verification before enabling payments')
    if (settings.deliveryCheckoutEnabled || settings.shoppingCheckoutEnabled) {
      const { data: ready, error } = await admin.rpc('godrop_launch_ready')
      if (
        error ||
        ready !== true ||
        !isStripeConfigured() ||
        !process.env.STRIPE_WEBHOOK_SECRET
      )
        throw new Error(
          'Apply the launch migration and configure Stripe webhooks before enabling checkout',
        )
    }
    if (
      settings.shoppingCheckoutEnabled &&
      (process.env.GODROP_SHOPPING_FUNDING_READY !== 'true' ||
        !process.env.STRIPE_ISSUING_WEBHOOK_SECRET)
    )
      throw new Error(
        'Verify GoDrop-funded purchase cards before enabling Buy for Me checkout',
      )
    await writeLaunchSettings(settings, user.id)
    return { success: true }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Could not save pricing settings',
    }
  }
}
