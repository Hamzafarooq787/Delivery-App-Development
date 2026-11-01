'use server'
import { getAdminActor } from "@/lib/admin-access"
import { after } from 'next/server'
import { notifyUser,notifySupportUpdate } from '@/lib/notifications/internal'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateProfile } from '@/lib/customer-validation'
import { getCustomerHomeData } from '@/lib/customer-home-data'
export type ThreadMessage = { id:string; sender_id:string; sender:string; body:string; created_at:string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
async function identity() {
 const c=await createClient(); const {data:{user}}=await c.auth.getUser(); return user
}
export async function getCustomerPayments(page:number,size:number,refunds=false) {
 const user=await identity(); if(!user)return {error:'Please sign in to view payments.'}
 const {data,error}=await createAdminClient().rpc('customer_payment_records',{p_customer:user.id,p_page:Math.max(1,Math.min(Math.trunc(page)||1,1000000)),p_size:Math.max(1,Math.min(Math.trunc(size)||10,50)),p_refunds:refunds===true})
 return error?{error:'Could not load payments. Please try again.'}:{data}
}
export async function getCustomerHomeSnapshot(){return getCustomerHomeData()}
export async function saveCustomerProfile(name:string,phone:string){
 const values=validateProfile(name,phone); if('error'in values)return values
 const user=await identity();if(!user)return {error:'Please sign in again.'}
 const client=await createClient()
 const {data,error}=await client.from('users').update(values).eq('id',user.id).select('full_name,phone').single()
 return error?{error:'Could not save your profile. Please try again.'}:{data}
}
export async function getSavedAddresses(){
 const user=await identity();if(!user)return {error:'Please sign in again.',data:[]}
 const {data,error}=await createAdminClient().from('addresses').select('id,address,lat,lng,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100)
 return error?{error:'Could not load saved addresses.',data:[]}:{data:data??[]}
}
export async function getCustomerThread(kind:'order'|'support',id:string,before?:string){
 const user=await identity();if(!user||!['order','support'].includes(kind)||!uuid.test(id))return {error:'Please sign in to view this conversation.'}
 const admin=createAdminClient()
 const {data:row,error}=await admin.from(kind==='order'?'delivery_requests':'support_tickets').select(kind==='order'?'customer_id,driver_id,status,order_messages':'user_id,status,message,replies,customer_unread,admin_unread').eq('id',id).maybeSingle()
 if(error||!row)return {error:'Conversation unavailable.'}
 const record=row as unknown as Record<string,any>
 let allowed=kind==='order'?(record.customer_id===user.id||record.driver_id===user.id):record.user_id===user.id
 if(!allowed&&kind==='support'){const {data:profile}=await admin.from('users').select('role').eq('id',user.id).maybeSingle();allowed=!!(await getAdminActor('support'))}
 if(!allowed)return {error:'Conversation unavailable.'}
 if(kind==='support'){const read=await admin.rpc('mark_support_read',{p_actor:user.id,p_id:id,p_seen:(record.replies??[]).length});if(read.error)return {error:'Conversation read status could not save. Please retry.'}}
 const all=(kind==='order'?record.order_messages:record.replies) as ThreadMessage[]??[]
 const end=before?all.findIndex(m=>m.id===before):all.length
 const last=end<0?all.length:end
 let contact:{name:string;phone:string|null}|null=null
 if(kind==='order'&&record.driver_id&&['accepted','collected','in_transit'].includes(record.status)){
 const other=record.customer_id===user.id?record.driver_id:record.customer_id
 const {data:p}=await admin.from('users').select('full_name,phone').eq('id',other).maybeSingle()
 contact={name:p?.full_name||'Your delivery contact',phone:p?.phone&&/^\+?[\d\s()-]{7,25}$/.test(p.phone)?p.phone.replace(/[^+\d]/g,''):null}
 }
 return {data:{messages:all.slice(Math.max(0,last-50),last),hasEarlier:last>50,status:record.status,original:record.message as string|undefined,contact,contactLabel:record.driver_id===user.id?'customer':'driver',canSend:kind==='support'||!!contact,userId:user.id}}
}
export async function sendCustomerThread(kind:'order'|'support',id:string,key:string,body:string){
 const user=await identity();if(!user||!uuid.test(id)||!uuid.test(key)||!['order','support'].includes(kind)||typeof body!=='string'||!body.trim()||body.trim().length>4000)return {error:'Enter a message of 1–4,000 characters.'}
 const admin=createAdminClient()
 if(kind==='order'){
   const {data,error}=await admin.rpc('send_customer_order_message',{p_id:id,p_actor:user.id,p_key:key,p_body:body.trim()})
   if(error)return {error:'Message could not be sent. Please retry.'}
   if(data?.created&&data.recipient&&data.url)after(async()=>{await notifyUser({userId:data.recipient,title:'New delivery message',body:'A new message is waiting in your order conversation.',url:data.url,tag:`order-message-${key}`})})
   return {success:true}
 }
 const {data:caller,error:callerError}=await admin.from('users').select('role,account_status').eq('id',user.id).maybeSingle()
 if(callerError||!caller||caller.account_status!=='active'||caller.role==='admin'&&!(await getAdminActor('support')))return {error:'Support permission and required MFA are needed.'}
 const {data,error}=await admin.rpc('send_support_message',{p_id:id,p_actor:user.id,p_key:key,p_body:body.trim()})
 if(!error&&data?.created)after(async()=>{await notifySupportUpdate(id,user.id,key)})
 return error?{error:'Message could not be sent. Please retry.'}:{success:true}
}
