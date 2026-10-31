'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getStripe } from '@/lib/stripe/server'
import type { DriverFinanceSnapshot } from '@/lib/driver-finance'

export async function getDriverFinance(page=1,period='all',payouts=false):Promise<{data?:DriverFinanceSnapshot;error?:string}> {
  const db=await createClient();const {data:{user}}=await db.auth.getUser()
  if(!user)return {error:'Please sign in again.'}
  const {data,error}=await createAdminClient().rpc('driver_finance_snapshot',{p_driver:user.id,p_page:Math.max(1,Math.min(Math.trunc(page)||1,1000000)),p_period:['day','week','month','all'].includes(period)?period:'all',p_payouts:payouts===true})
  return error?{error:'Earnings could not load. Please retry.'}:{data}
}

export async function getDriverBankStatus() {
  const db=await createClient();const {data:{user}}=await db.auth.getUser()
  if(!user)return {state:'error',message:'Please sign in again.'}
  const admin=createAdminClient()
  const [profile,settings]=await Promise.all([
    admin.from('driver_profiles').select('stripe_connect_account_id,status').eq('id',user.id).maybeSingle(),
    admin.from('surge_pricing_settings').select('automatic_payouts').eq('id',true).single(),
  ])
  if(profile.error||settings.error)return {state:'error',message:'Bank status could not load. Please retry.'}
  const automatic=settings.data.automatic_payouts===true
  if(!profile.data?.stripe_connect_account_id)return {state:'not_connected',automatic,message:'Add your bank account and complete Stripe identity checks.'}
  try {
    const account=await getStripe().v2.core.accounts.retrieve(profile.data.stripe_connect_account_id,{include:['configuration.recipient','requirements']})
    const capabilities=account.configuration?.recipient?.capabilities?.stripe_balance
    const ready=capabilities?.stripe_transfers?.status==='active'&&capabilities?.payouts?.status==='active'
    return {state:ready?'ready':'action_required',automatic,message:ready?'Bank account verified.': 'Stripe needs more information. Open bank setup to see and complete the required checks.'}
  }catch{return {state:'error',automatic,message:'Stripe bank status is unavailable. Your earnings remain recorded. Please retry.'}}
}

export async function getDriverCustomerContact(id:string){
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return null
  const admin=createAdminClient();const {data:order}=await admin.from('delivery_requests').select('customer_id,status').eq('id',id).eq('driver_id',user.id).maybeSingle()
  if(!order||!['accepted','collected','picked_up','in_transit'].includes(order.status))return null
  const {data}=await admin.from('users').select('full_name,phone').eq('id',order.customer_id).maybeSingle()
  return data?{...data,email:null}:null
}

export async function changeCollectionWait(id:string,action:'start'|'request'|'approve'|'decline'){
  if(!/^[0-9a-f-]{36}$/i.test(id)||!['start','request','approve','decline'].includes(action))return {error:'Invalid waiting request.'}
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return {error:'Please sign in again.'}
  const {data,error}=await createAdminClient().rpc('driver_collection_wait',{p_id:id,p_actor:user.id,p_action:action})
  if(error)return {error:'Waiting is available only before collection. The first 5 minutes are free; a rate must be configured before requesting a charge.'}
  revalidatePath(`/dashboard/driver/jobs/${id}`);revalidatePath('/dashboard/customer/tracking');return {data}
}

export async function getCollectionWait(id:string){
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return {error:'Please sign in again.'}
  const {data,error}=await db.from('delivery_requests').select('collection_wait,driver_id,customer_id,status,service_type').eq('id',id).maybeSingle()
  if(error||!data||(data.driver_id!==user.id&&data.customer_id!==user.id))return {error:'Waiting information is unavailable.'}
  const {data:settings}=await createAdminClient().from('surge_pricing_settings').select('booking_pricing').eq('id',true).single()
  return {data:{...data,waiting_rate:Number(settings?.booking_pricing?.waitingPerMinute??0)}}
}
