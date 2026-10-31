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
  if (config.maxShoppingProducts < 15) return { error: 'Allow at least 15 different shopping products (maximum 50).' }
  const { error } = await admin.rpc('save_booking_pricing',{p_actor:user.id,p_config:config})
  if (error) return { error: 'Could not save pricing settings.' }
  revalidatePath('/dashboard/admin/settings')
  return { success: true }
}

export async function getBookingPricingHistory():Promise<{at:string;before:Record<string,number>;after:Record<string,number>}[]>{
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)return[]
 const admin=createAdminClient();const {data:caller}=await admin.from('users').select('role').eq('id',user.id).maybeSingle();if(caller?.role!=='admin')return[]
 const {data}=await admin.from('surge_pricing_settings').select('booking_pricing_history').eq('id',true).single()
 return (data?.booking_pricing_history??[]).slice(-10).reverse().map((row:{at:string;before:Record<string,number>;after:Record<string,number>})=>({at:row.at,before:row.before,after:row.after}))
}
