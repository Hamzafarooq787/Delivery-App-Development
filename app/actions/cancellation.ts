"use server"
import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { boundedFetch } from "@/lib/short-request"
import { getAdminActor, runAdminMutation } from "@/lib/admin-access"
import { getStripe } from "@/lib/stripe/server"
import { processOrderRefunds } from "@/lib/payments/direct"
import { DEFAULT_CANCELLATION, validCancellationSettings, type CancellationSettings } from "@/lib/cancellation-policy"
import { notifySupportUpdate, notifyUser } from "@/lib/notifications/internal"

export async function getCancellationSettings(){
 const {data,error}=await createAdminClient(boundedFetch(4000)).from("surge_pricing_settings").select("cancellation_settings").eq("id",true).single()
 if(error||!validCancellationSettings(data?.cancellation_settings))throw Error("Cancellation policy could not load.")
 return data.cancellation_settings as CancellationSettings
}
export async function saveCancellationSettings(value:CancellationSettings){
 return runAdminMutation("settings","cancellation_settings","settings",async()=>{
  if(!validCancellationSettings(value))return {error:"Enter valid fees and driver compensation no higher than the customer fee."}
  const {error}=await createAdminClient().from("surge_pricing_settings").update({cancellation_settings:value}).eq("id",true).select("id").single()
  if(error)return {error:"Policy could not save."}
  revalidatePath("/dashboard/admin/settings")
  return {success:true}
 })
}
export async function getCancellationQuote(id:string,fault="customer"){
 const db=await createClient(boundedFetch(5000));const {data:{user}}=await db.auth.getUser()
 if(!user||!/^[a-f0-9-]{36}$/i.test(id))return {error:"Sign in to view this order."}
 if(fault!=="customer"&&fault!=="driver"&&!(await getAdminActor("finance")))return {error:"Finance access required."}
 const {data,error}=await createAdminClient(boundedFetch(5000)).rpc("cancellation_quote",{p_actor:user.id,p_id:id,p_fault:fault})
 return error?{error:"Cancellation details could not load."}:{data:data as {fee:number;driver:number;platform:number;refund:number;review:boolean;status:string;canCancel:boolean;method:string}}
}
export async function cancelByPolicy(id:string,fee:number,reason="Customer cancellation",fault="customer"){
 const db=await createClient(boundedFetch(5000));const {data:{user}}=await db.auth.getUser()
 if(!user)return {error:"Please sign in again."}
 const preview=await getCancellationQuote(id,fault)
 if(!preview.data)return {error:preview.error}
 const admin=createAdminClient(boundedFetch(7000))
 const {data:order}=await admin.from("delivery_requests").select("company_card_reference,driver_id,customer_id,status").eq("id",id).maybeSingle()
 if(!order)return {error:"Order unavailable."}
 // Closing a dedicated card prevents a purchase racing a pre-purchase refund.
 if(order.company_card_reference&&!preview.data.review&&order.status!=="cancelled"){
  try{
   const stripe=getStripe()
   const card=await stripe.issuing.cards.retrieve(order.company_card_reference)
   if(card.metadata.godrop_job_id!==id)return {error:"The purchase card needs a support review."}
   if(card.status!=="canceled")await stripe.issuing.cards.update(card.id,{status:"canceled"})
   const [spend,holds]=await Promise.all([stripe.issuing.transactions.list({card:card.id,limit:1}),stripe.issuing.authorizations.list({card:card.id,status:"pending",limit:100})])
   if(spend.data.length || holds.data.some(h=>h.approved)){
    const {error:holdError}=await admin.from("delivery_requests").update({recovery_case:{status:"open",action:"cancellation_review",reason:"Stripe spending or authorisation needs review before cancellation.",actor:user.id,at:new Date().toISOString()}}).eq("id",id).in("status",["accepted","collected"]).select("id").single()
    if(holdError)return {error:"Purchase reconciliation is needed. Contact support. No automatic refund was issued."}
    revalidatePath(`/dashboard/admin/orders/${id}`);revalidatePath("/dashboard/customer/tracking")
    return {data:{...preview.data,review:true}}
   }
  }catch{return {error:"The purchase card could not be safely closed. Contact support; no refund was confirmed."}}
 }
 const {data,error}=await admin.rpc("cancel_with_policy",{p_actor:user.id,p_id:id,p_fee:fee,p_reason:reason,p_fault:fault})
 if(error)return {error:error.message.includes("fee_changed")?"The driver’s stage changed. Reopen cancellation to confirm the current fee.":"Cancellation could not be confirmed. Refresh before trying again."}
 if(data.review){
  after(async()=>{const {data:staff}=await admin.from("users").select("id").eq("role","admin").limit(50);await Promise.allSettled((staff??[]).map(a=>notifyUser({userId:a.id,title:"Cancellation requires review",body:"Purchases or collected goods need a return or delivery decision.",url:`/dashboard/admin/orders/${id}`,tag:`cancellation-review-${id}`})))})
 }else await processOrderRefunds(id).catch(()=>{})
 revalidatePath(`/dashboard/admin/orders/${id}`);revalidatePath("/dashboard/admin/payments");revalidatePath("/dashboard/customer/tracking");revalidatePath("/dashboard/driver","layout")
 return {data:data as typeof preview.data}
}
export async function recordCollectionMilestone(id:string,stage:"travel"|"arrived"){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return {error:"Sign in again."}
 const {error}=await createAdminClient().rpc("collection_milestone",{p_actor:user.id,p_id:id,p_stage:stage})
 if(error)return {error:"This stage could not save. Refresh the job before retrying."}
 revalidatePath(`/dashboard/driver/jobs/${id}`);revalidatePath("/dashboard/driver/active-jobs")
 return {success:true}
}
