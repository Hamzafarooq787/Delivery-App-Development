import 'server-only'
import {asUtc} from '@/lib/admin-operations'
import {canRetryCreate} from '@/lib/payouts/engine'
import {fulfillWaitingSession} from './waiting'
/** Rotate only after Stripe proves the previous attempt cannot take payment. */
export async function openWaitingCheckout(db:any,stripe:any,payment:any,user:{id:string;email?:string},origin:string,now=Date.now()){
 let p=payment
 const verify=(session:any)=>{if(session.metadata?.type!=='collection_wait'||session.metadata?.payment_id!==p.id||session.metadata?.user_id!==user.id||session.currency!=='gbp'||session.amount_total!==Math.round(Number(p.amount)*100)||Number(session.metadata?.checkout_attempt??0)!==Number(p.checkout_attempt??0))throw Error('Provider checkout reference does not match this approved waiting payment.')}
 const bind=async(session:any)=>{const result=await db.rpc('bind_waiting_checkout',{p_actor:user.id,p_payment:p.id,p_attempt:Number(p.checkout_attempt??0),p_session:session.id});if(result.error)throw result.error;p={...p,stripe_session_id:session.id}}
 let old=p.stripe_session_id?await stripe.checkout.sessions.retrieve(p.stripe_session_id):null
 const started=asUtc(p.checkout_started_at??p.created_at)
 if(!old&&!canRetryCreate(started,now)){
  const start=Date.parse(started);let scanned=0
  for await(const session of stripe.checkout.sessions.list({limit:100,created:{gte:Math.floor(start/1000)-60,lte:Math.floor((start+20*3600000)/1000)}})){
   if(++scanned>2000)throw Error('Too many provider records to reconcile automatically. Contact support; no new charge was created.')
   if(session.metadata?.payment_id===p.id&&Number(session.metadata?.checkout_attempt??0)===Number(p.checkout_attempt??0)){if(old)throw Error('Multiple provider records need support review.');old=session}
  }
  if(!old&&now-start<24*3600000)throw Error('The earlier checkout is still being reconciled. Please retry after its safety window; no second charge was created.')
 }
 if(old){verify(old);if(!p.stripe_session_id)await bind(old);if(old.payment_status==='paid'){await fulfillWaitingSession(old);return{paid:true}}
  if(old.status==='open'&&old.url)return{url:old.url}
  if(old.status!=='expired'||old.payment_status!=='unpaid')throw Error('Stripe has not confirmed that this checkout is safe to replace.')
 }
 if(old||!canRetryCreate(started,now)){
  const restarted=await db.rpc('restart_waiting_checkout',{p_actor:user.id,p_payment:p.id,p_session:old?.id??null,p_attempt:Number(p.checkout_attempt??0),p_verified_missing:!old});if(restarted.error)throw restarted.error;p=restarted.data
  // Another request may already have attached the next attempt. Recover it rather than creating a second session.
  if(p.stripe_session_id){const next=await stripe.checkout.sessions.retrieve(p.stripe_session_id);verify(next);if(next.payment_status==='paid'){await fulfillWaitingSession(next);return{paid:true}}if(next.status==='open'&&next.url)return{url:next.url};throw Error('Refresh to recover the latest checkout attempt.')}
 }
 const attempt=Number(p.checkout_attempt??0)
 const checkout=await stripe.checkout.sessions.create({mode:'payment',payment_method_types:['card'],customer_email:user.email,line_items:[{price_data:{currency:'gbp',unit_amount:Math.round(Number(p.amount)*100),product_data:{name:'Approved collection waiting charge'}},quantity:1}],metadata:{type:'collection_wait',payment_id:p.id,user_id:user.id,...(attempt>0?{checkout_attempt:String(attempt)}:{})},success_url:`${origin}/dashboard/customer/tracking?id=${p.related_delivery_id}&waiting_session={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/dashboard/customer/tracking?id=${p.related_delivery_id}`},{idempotencyKey:attempt===0?`waiting:${p.id}`:`waiting:${p.id}:attempt:${attempt}`})
 verify(checkout);await bind(checkout);if(!checkout.url)throw Error('Stripe did not return a checkout URL.');return{url:checkout.url}
}
