"use server"

import { runAdminMutation } from "@/lib/admin-access"
import { getAdminActor } from "@/lib/admin-access"
import { cancelByPolicy, getCancellationQuote } from "@/app/actions/cancellation"
import type { CancellationPreview } from "@/lib/cancellation-policy"
import { cancelCardBooking } from "@/app/actions/order-checkout"
import { processOrderRefunds } from "@/lib/payments/direct"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export type WalletTransaction = {
  id: string
  type: "topup" | "cashback" | "cancellation_fee" | "deduction"
  amount: number
  description: string | null
  delivery_id: string | null
  created_at: string
}

// ── Haversine distance in miles ───────────────────────────────────────────
function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Get wallet balance ────────────────────────────────────────────────────
export async function getWalletBalance(): Promise<{ balance: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { balance: 0, error: "Not authenticated" }

  const admin = createAdminClient()
  const { data, error } = await admin.from("wallet_balances").select("balance").eq("user_id", user.id).single()
  return error && error.code !== "PGRST116" ? { balance:0,error:"Could not load wallet balance." } : { balance: data ? Number(data.balance) : 0 }
}

// ── Get wallet transactions ───────────────────────────────────────────────
export async function getWalletTransactions(page=1,size=20):Promise<{data:WalletTransaction[];totalCount:number;page:number;error?:string}> {
  const client=await createClient();const {data:{user}}=await client.auth.getUser()
  if(!user)return {data:[],totalCount:0,page:1,error:'Please sign in again.'}
  const limit=Math.max(1,Math.min(50,Math.trunc(size)||20)),requested=Math.max(1,Math.min(1000000,Math.trunc(page)||1))
  const {data,count,error}=await createAdminClient().from('wallet_transactions')
    .select('id,type,amount,description,delivery_id,created_at',{count:'exact'})
    .eq('user_id',user.id).order('created_at',{ascending:false}).order('id',{ascending:false})
    .range((requested-1)*limit,requested*limit-1)
  return {data:(data??[]) as WalletTransaction[],totalCount:count??0,page:requested,...(error?{error:'Could not load wallet transactions. Please retry.'}:{})}
}

// ── Cancel order (customer) ───────────────────────────────────────────────
export type CancelOrderResult = {
  paymentMethod?: "stripe" | "wallet"
  success: boolean
  freeCancel: boolean
  cancellationFee: number
  distanceMiles: number
  refundAmount: number
  error?: string
}

export async function cancelOrder(deliveryId: string, confirmedFee=0): Promise<CancelOrderResult> {
 const result=await cancelByPolicy(deliveryId,confirmedFee)
 if(!result.data || result.data.review)return {success:false,freeCancel:false,cancellationFee:0,distanceMiles:0,refundAmount:0,error:result.error??"Cancellation is waiting for admin review."}
 return {success:true,paymentMethod:result.data.method as "stripe"|"wallet",freeCancel:Number(result.data.fee)===0,cancellationFee:Number(result.data.fee),distanceMiles:0,refundAmount:Number(result.data.refund)}
}

export async function previewCancellationFee(deliveryId:string){
 const result=await getCancellationQuote(deliveryId)
 return {freeCancel:result.data?.fee===0,cancellationFee:Number(result.data?.fee??0),distanceMiles:0,status:result.data?.status??"",canCancel:result.data?.canCancel??false,error:result.error}
}

// ── Admin: cancel an order and optionally refund the customer ─────────────
export async function adminCancelOrder(deliveryId:string,reason:string,fault="admin",expected?:CancellationPreview):Promise<{success?:boolean;refunded?:boolean;refundAmount?:number;review?:boolean;error?:string}> {
 return runAdminMutation("finance","adminCancelOrder",deliveryId,async()=>{
  if(reason.trim().length<3)return {error:"Choose a reason and add any relevant notes."}
  if(!expected?.canCancel)return {error:"Review the cancellation preview before confirming."}
  const result=await cancelByPolicy(deliveryId,Number(expected.fee),reason,fault,expected)
  if(!result.data)return {error:result.error}
  return {success:true,refunded:false,refundAmount:Number(result.data.refund),review:result.data.review}
 })
}

// ── Admin: issue a manual refund to the customer's wallet ─────────────────
export async function adminIssueRefund(deliveryId: string, amount: number, requestKey: string): Promise<{
  success?: boolean
  error?: string
}> {
 return runAdminMutation("finance","adminIssueRefund",deliveryId,async()=>{
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }
  const { data: adminRow } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
  if (!(await getAdminActor("finance"))) return { error: "Not authorized" }

  if (!amount || amount <= 0) return { error: "Invalid refund amount" }

  const admin = createAdminClient()

  if(!Number.isFinite(amount)||!requestKey)return {error:"Invalid refund request"}
  const {error}=await admin.rpc("admin_wallet_refund",{p_order:deliveryId,p_actor:user.id,p_amount:amount,p_key:requestKey,p_cancel:false})
  if(error)return {error:error.message}
  const {revalidatePath}=await import("next/cache");revalidatePath(`/dashboard/admin/orders/${deliveryId}`)
  return {success:true}

 })
}
