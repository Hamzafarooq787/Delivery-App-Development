'use server'
import {createClient} from '@/lib/supabase/server'
import {createAdminClient} from '@/lib/supabase/admin'
import {getStripe} from '@/lib/stripe/server'
import {fulfillWaitingSession} from '@/lib/payments/waiting'
import {openWaitingCheckout} from '@/lib/payments/waiting-checkout'
export async function createWaitingPayment(id:string,key:string):Promise<{error?:string;url?:string;paid?:boolean}>{
 if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(key))return{error:'Invalid waiting request.'}
 const session=await createClient();const {data:{user}}=await session.auth.getUser();if(!user)return{error:'Please sign in.'}
 const db=createAdminClient();const reserved=await db.rpc('reserve_waiting_checkout',{p_actor:user.id,p_id:id,p_key:key});if(reserved.error)return{error:'Approve the waiting request before paying. Only the customer can pay.'};if(reserved.data.status==='paid')return{paid:true}
 try{const origin=new URL(process.env.NEXT_PUBLIC_APP_URL||'https://godrop.uk').origin;if(!origin.startsWith('https://'))throw Error('HTTPS app URL required.');return await openWaitingCheckout(db,getStripe(),reserved.data,user,origin)}catch(error){console.error('[Waiting checkout]',error);return{error:'Checkout could not be confirmed. Retry to recover the same approved payment, or contact support. No second payment has been requested.'}}
}
export async function confirmWaitingPayment(reference:string){const session=await createClient();const {data:{user}}=await session.auth.getUser();if(!user)return{error:'Please sign in.'};try{const checkout=await getStripe().checkout.sessions.retrieve(reference);if(checkout.metadata?.user_id!==user.id)return{error:'Payment unavailable.'};await fulfillWaitingSession(checkout);return{success:true}}catch{return{error:'Payment confirmation is pending. Do not pay again; refresh or contact support.'}}}
