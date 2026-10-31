'use server'
import {createClient} from '@/lib/supabase/server'
import {createAdminClient} from '@/lib/supabase/admin'
import {getStripe} from '@/lib/stripe/server'
import {fulfillWaitingSession} from '@/lib/payments/waiting'
import {canRetryCreate} from '@/lib/payouts/engine'
import {asUtc} from '@/lib/admin-operations'
export async function createWaitingPayment(id:string,key:string){
 if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(key))return{error:'Invalid waiting request.'}
 const session=await createClient();const {data:{user}}=await session.auth.getUser();if(!user)return{error:'Please sign in.'}
 const db=createAdminClient();const reserved=await db.rpc('reserve_waiting_checkout',{p_actor:user.id,p_id:id,p_key:key});if(reserved.error)return{error:'Approve the waiting request before paying. Only the customer can pay.'};const p=reserved.data
 if(p.status==='paid')return{paid:true}
 try{const stripe=getStripe();if(p.stripe_session_id){const old=await stripe.checkout.sessions.retrieve(p.stripe_session_id);if(old.payment_status==='paid'){await fulfillWaitingSession(old);return{paid:true}}if(old.status==='open'&&old.url)return{url:old.url};return{error:'This checkout needs reconciliation. Contact support; do not pay twice.'}}
 if(!canRetryCreate(asUtc(p.created_at),Date.now()))return{error:'This payment request is too old to retry safely. Please contact support.'}
 const origin=new URL(process.env.NEXT_PUBLIC_APP_URL||'https://godrop.uk').origin;if(!origin.startsWith('https://'))throw new Error('HTTPS required')
 const checkout=await stripe.checkout.sessions.create({mode:'payment',payment_method_types:['card'],customer_email:user.email,line_items:[{price_data:{currency:'gbp',unit_amount:Math.round(Number(p.amount)*100),product_data:{name:'Approved collection waiting charge'}},quantity:1}],metadata:{type:'collection_wait',payment_id:p.id,user_id:user.id},success_url:`${origin}/dashboard/customer/tracking?id=${id}&waiting_session={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/dashboard/customer/tracking?id=${id}`},{idempotencyKey:`waiting:${p.id}`})
 const saved=await db.from('payments').update({stripe_session_id:checkout.id}).eq('id',p.id).is('stripe_session_id',null);if(saved.error)throw saved.error;return{url:checkout.url??undefined}
 }catch{return{error:'Payment checkout could not open. Retry the same request; do not create another payment.'}}
}
export async function confirmWaitingPayment(reference:string){const session=await createClient();const {data:{user}}=await session.auth.getUser();if(!user)return{error:'Please sign in.'};try{const checkout=await getStripe().checkout.sessions.retrieve(reference);if(checkout.metadata?.user_id!==user.id)return{error:'Payment unavailable.'};await fulfillWaitingSession(checkout);return{success:true}}catch{return{error:'Payment confirmation is pending. Do not pay again; refresh or contact support.'}}}
