import 'server-only'
import type Stripe from 'stripe'
import {createAdminClient} from '@/lib/supabase/admin'
import {reconcilePaymentProcessingFee,processOrderRefunds} from './direct'
export async function fulfillWaitingSession(session:Stripe.Checkout.Session){
 if(session.metadata?.type!=='collection_wait'||session.payment_status!=='paid'||session.currency!=='gbp'||!session.metadata.payment_id||!session.metadata.user_id||session.amount_total==null)throw new Error('Waiting payment not confirmed')
 const intent=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id;if(!intent)throw new Error('Missing payment reference')
 const db=createAdminClient();const payment=await db.from('payments').select('id,stripe_session_id').eq('id',session.metadata.payment_id).eq('customer_id',session.metadata.user_id).eq('purpose','collection_wait').maybeSingle();if(payment.error||!payment.data||payment.data.stripe_session_id!==session.id)throw new Error('Waiting payment mismatch')
 const result=await db.rpc('finalize_waiting_checkout',{p_payment:payment.data.id,p_session:session.id,p_intent:intent,p_amount:session.amount_total/100});if(result.error)throw result.error
 await reconcilePaymentProcessingFee(payment.data.id,intent).catch(()=>false)
 await processOrderRefunds(result.data).catch(()=>{})
 return result.data as string
}
