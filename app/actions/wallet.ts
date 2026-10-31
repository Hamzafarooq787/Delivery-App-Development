"use server"

import { runAdminMutation } from "@/lib/admin-access"
import { getAdminActor } from "@/lib/admin-access"
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

export async function cancelOrder(deliveryId: string): Promise<CancelOrderResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, freeCancel: false, cancellationFee: 0, distanceMiles: 0, refundAmount: 0, error: "Not authenticated" }

  const { data: cardOrder } = await createAdminClient().from("delivery_requests").select("payment_method,cancellation_policy").eq("id",deliveryId).eq("customer_id",user.id).maybeSingle()
  if(cardOrder?.cancellation_policy?.before==="review")return{success:false,freeCancel:false,cancellationFee:0,distanceMiles:0,refundAmount:0,error:"Contact support to review this cancellation. No extra charge has been created."}
  if (cardOrder?.payment_method === "stripe") {
    const result = await cancelCardBooking(deliveryId)
    return { paymentMethod:"stripe", success: !result.error, freeCancel: true, cancellationFee: 0, distanceMiles: 0, refundAmount: result.amount ?? 0, error: result.error }
  }
  // Atomic RPC — locks the delivery row before doing anything, so concurrent
  // cancel calls on the same order can't both read "still cancellable" and
  // both credit a refund. See scripts/030_security_hardening.sql.
  const { data, error } = await supabase.rpc("cancel_delivery_order", { p_delivery_id: deliveryId })

  if (error) {
    const msg = error.message ?? ""
    let friendly = "Could not cancel this order. Please try again."
    if (msg.includes("not_found")) friendly = "Order not found"
    else if (msg.includes("not_your_order")) friendly = "Not your order"
    else if (msg.includes("cannot_cancel")) friendly = "This order cannot be cancelled"
    return { success: false, freeCancel: false, cancellationFee: 0, distanceMiles: 0, refundAmount: 0, error: friendly }
  }

  return {
    success: true,
    freeCancel: data.freeCancel,
    cancellationFee: Number(data.cancellationFee),
    distanceMiles: Number(data.distanceMiles),
    refundAmount: Number(data.refundAmount),
  }
}

// ── Preview cancellation fee (before confirming) ──────────────────────────
export async function previewCancellationFee(deliveryId: string): Promise<{
  freeCancel: boolean
  cancellationFee: number
  distanceMiles: number
  status: string
  canCancel: boolean
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { freeCancel: false, cancellationFee: 0, distanceMiles: 0, status: "", canCancel: false, error: "Not authenticated" }

  const admin = createAdminClient()
  const { data: delivery } = await admin
    .from("delivery_requests")
    .select("id, status, customer_id, pickup_lat, pickup_lng, delivery_lat, delivery_lng, payment_method, bfm_stage,cancellation_policy")
    .eq("id", deliveryId)
    .single()

  if (!delivery || (delivery as any).customer_id !== user.id) {
    return { freeCancel: false, cancellationFee: 0, distanceMiles: 0, status: "", canCancel: false, error: "Not found" }
  }

  const status = (delivery as any).status as string
  if (status === "delivered" || status === "cancelled") {
    return { freeCancel: false, cancellationFee: 0, distanceMiles: 0, status, canCancel: false }
  }

  const allowed=['requested','accepted'].includes(status)&&!['shopping','purchase_completed','heading_to_customer'].includes(delivery.bfm_stage??'')&&delivery.cancellation_policy?.before!=='review'
  return {freeCancel:allowed,cancellationFee:0,distanceMiles:0,status,canCancel:allowed,...(!allowed?{error:'Contact support for cancellation review or recovery after collection.'}:{})}

}

// ── Admin: cancel an order and optionally refund the customer ─────────────
export async function adminCancelOrder(deliveryId: string): Promise<{
  success?: boolean
  refunded?: boolean
  refundAmount?: number
  error?: string
}> {
 return runAdminMutation("finance","adminCancelOrder",deliveryId,async()=>{
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }
  const { data: adminRow } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
  if (!(await getAdminActor("finance"))) return { error: "Not authorized" }

  const admin = createAdminClient()

  const { data: cardOrder } = await admin.from("delivery_requests").select("payment_method").eq("id",deliveryId).maybeSingle()
  if (cardOrder?.payment_method === "stripe") {
    const result = await cancelCardBooking(deliveryId)
    return result.error ? { error: result.error } : { success: true, refunded: false, refundAmount: result.amount }
  }
  const {data,error}=await admin.rpc("admin_wallet_refund",{p_order:deliveryId,p_actor:user.id,p_amount:0,p_key:crypto.randomUUID(),p_cancel:true})
  if(error)return {error:error.message}
  const {revalidatePath}=await import("next/cache");revalidatePath("/dashboard/admin/orders");
  return {success:true,refunded:Number(data)>0,refundAmount:Number(data)}

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
