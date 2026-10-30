'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { validateBookingPricing, type BookingPricing } from '@/lib/booking-pricing'
export async function getBookingPricing(): Promise<BookingPricing> {
  const { data, error } = await createAdminClient().from('surge_pricing_settings').select('booking_pricing').eq('id', true).single()
  if (error || !validateBookingPricing(data?.booking_pricing)) throw new Error('Pricing settings are unavailable. Please retry.')
  return data.booking_pricing
}
export async function saveBookingPricing(config: BookingPricing) {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const admin = createAdminClient()
  const { data: caller } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  if (caller?.role !== 'admin') return { error: 'Not authorized' }
  if (!validateBookingPricing(config)) return { error: 'Enter valid non-negative prices and a positive base fare (maximum 500).' }
  const { data, error } = await admin.from('surge_pricing_settings').update({ booking_pricing: config, updated_at: new Date().toISOString() }).eq('id', true).select('id').maybeSingle()
  if (error || !data) return { error: 'Could not save pricing settings.' }
  revalidatePath('/dashboard/admin/settings')
  return { success: true }
}
