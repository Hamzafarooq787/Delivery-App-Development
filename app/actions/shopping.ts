"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { notifyUser, notifyMultipleUsers } from "@/app/actions/notifications"
import { getDeliveryQuote } from "@/app/actions/pricing"

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShoppingItem = {
  name: string
  quantity: number
  estimated_price?: number | null
  brand_size_variant?: string | null
  notes?: string | null
  photo_url?: string | null
  substitution_preference: "contact_me" | "best_alternative" | "skip_if_unavailable"
}

export type CreateShoppingRequestParams = {
  shop_name: string
  shop_address: string
  shop_lat: number
  shop_lng: number
  shop_instructions?: string | null
  delivery_address: string
  delivery_lat: number
  delivery_lng: number
  shopping_items: ShoppingItem[]
  promo_code?: string | null
}

export type CreateShoppingRequestResult =
  | { data: { id: string; tracking_number: string } }
  | { error: string; code?: "insufficient_funds" | "not_authenticated" | "spend_limit_exceeded" | "bfm_disabled" }

export type BfmSettings = {
  enabled: boolean
  max_purchase_amount: number
  service_fee_percentage: number
}

// ── BFM Settings ──────────────────────────────────────────────────────────────

export async function getBfmSettings(): Promise<BfmSettings> {
  const admin = createAdminClient()
  const { data } = await admin.from("bfm_settings").select("*").single()
  return data ?? { enabled: true, max_purchase_amount: 50, service_fee_percentage: 10 }
}

export async function updateBfmSettings(settings: Partial<BfmSettings>): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }
  const { data: profile } = await createAdminClient().from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: "Unauthorised" }

  const admin = createAdminClient()
  const { error } = await admin
    .from("bfm_settings")
    .update({ ...settings, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", 1)

  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/settings")
  return {}
}

// ── Customer: Create shopping request ────────────────────────────────────────

export async function createShoppingRequest(
  params: CreateShoppingRequestParams
): Promise<CreateShoppingRequestResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated", code: "not_authenticated" }

  const admin = createAdminClient()

  // Check BFM is enabled and get settings
  const bfm = await getBfmSettings()
  if (!bfm.enabled) return { error: "Buy for Me is currently unavailable.", code: "bfm_disabled" }

  // Validate items
  if (!params.shopping_items || params.shopping_items.length === 0) {
    return { error: "Please add at least one item to your shopping list." }
  }

  // Compute estimated items total
  const estimatedTotal = params.shopping_items.reduce(
    (sum, item) => sum + (item.estimated_price ?? 0) * item.quantity,
    0
  )

  // Check against spending limit
  if (estimatedTotal > 0 && estimatedTotal > bfm.max_purchase_amount) {
    return {
      error: `Your estimated shopping total (£${estimatedTotal.toFixed(2)}) exceeds the maximum allowed amount of £${bfm.max_purchase_amount.toFixed(2)}.`,
      code: "spend_limit_exceeded",
    }
  }

  // Get delivery quote (shop → customer delivery)
  const quoteResult = await getDeliveryQuote({
    pickupLat: params.shop_lat,
    pickupLng: params.shop_lng,
    deliveryLat: params.delivery_lat,
    deliveryLng: params.delivery_lng,
    packageSize: "medium", // shopping bags always medium
    promoCode: params.promo_code,
  })

  if ("error" in quoteResult) return { error: quoteResult.error }
  const quote = quoteResult.data

  // Service fee on top of delivery fee
  const serviceFee = parseFloat((quote.finalPrice * (bfm.service_fee_percentage / 100)).toFixed(2))
  const deliveryFee = parseFloat((quote.finalPrice + serviceFee).toFixed(2))

  // max_spend is the lower of the configured limit or the customer's estimate (if provided)
  const maxSpend = bfm.max_purchase_amount

  // Total wallet deduction at booking: delivery fee + items hold
  const totalCharge = parseFloat((deliveryFee + maxSpend).toFixed(2))

  // Check wallet balance
  const { data: walletRow } = await admin
    .from("wallet_balances")
    .select("balance")
    .eq("user_id", user.id)
    .single()

  const balance = walletRow?.balance ?? 0
  if (balance < totalCharge) {
    return {
      error: `Insufficient wallet balance. You need £${totalCharge.toFixed(2)} (delivery fee + shopping funds hold). Your balance: £${balance.toFixed(2)}.`,
      code: "insufficient_funds",
    }
  }

  const tracking_number = `BFM-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  // Create request via service-role RPC
  const { data: deliveryId, error: rpcError } = await admin.rpc(
    "create_shopping_request_with_wallet_payment",
    {
      p_customer_id: user.id,
      p_tracking_number: tracking_number,
      p_delivery_address: params.delivery_address,
      p_delivery_lat: params.delivery_lat,
      p_delivery_lng: params.delivery_lng,
      p_shop_name: params.shop_name,
      p_shop_address: params.shop_address,
      p_shop_lat: params.shop_lat,
      p_shop_lng: params.shop_lng,
      p_shop_instructions: params.shop_instructions || null,
      p_price: deliveryFee,
      p_base_price: quote.basePrice,
      p_service_fee: serviceFee,
      p_estimated_items_total: estimatedTotal || null,
      p_max_spend_approved: maxSpend,
      p_promo_code: quote.promoCodeText || null,
      p_discount_amount: quote.discountAmount,
      p_surge_multiplier: quote.surgeMultiplier,
    }
  )

  if (rpcError) {
    if (rpcError.message?.includes("Insufficient wallet balance")) {
      return { error: "Insufficient wallet balance.", code: "insufficient_funds" }
    }
    console.error("[Shopping] createShoppingRequest RPC failed:", rpcError)
    return { error: "Could not create the shopping request. Please try again." }
  }

  const deliveryIdStr = deliveryId as string

  // Deduct the shopping hold separately (delivery fee was charged in RPC)
  // Insert shopping items
  const itemRows = params.shopping_items.map((item) => ({
    delivery_id: deliveryIdStr,
    name: item.name,
    quantity: item.quantity,
    estimated_price: item.estimated_price || null,
    brand_size_variant: item.brand_size_variant || null,
    notes: item.notes || null,
    photo_url: item.photo_url || null,
    substitution_preference: item.substitution_preference,
    status: "pending",
  }))

  await admin.from("shopping_items").insert(itemRows)

  // Charge the shopping funds hold from wallet
  await admin.rpc("increment_wallet_balance", { p_user_id: user.id, p_amount: -maxSpend })
  await admin.from("wallet_transactions").insert({
    user_id: user.id,
    type: "deduction",
    amount: maxSpend,
    description: `Buy for Me shopping funds hold - ${tracking_number}`,
    delivery_id: deliveryIdStr,
  })

  revalidatePath("/dashboard/customer")
  revalidatePath("/dashboard/customer/active-deliveries")
  revalidatePath("/dashboard/customer/wallet")

  // Notify online approved drivers
  notifyDriversOfNewShoppingJob(deliveryIdStr, params.shop_name, params.shop_address).catch(console.error)

  return { data: { id: deliveryIdStr, tracking_number } }
}

async function notifyDriversOfNewShoppingJob(
  deliveryId: string,
  shopName: string,
  shopAddress: string
): Promise<void> {
  const admin = createAdminClient()
  const { data: drivers } = await admin
    .from("driver_profiles")
    .select("id")
    .eq("status", "approved")
    .eq("is_online", true)

  if (!drivers?.length) return

  // BFM jobs can be done by any vehicle (medium capacity)
  const { data: vehicles } = await admin
    .from("driver_vehicles")
    .select("driver_id")
    .in("driver_id", drivers.map((d) => d.id))

  const driverIds = [...new Set((vehicles ?? []).map((v) => v.driver_id))]
  if (!driverIds.length) return

  await notifyMultipleUsers({
    userIds: driverIds,
    title: "🛍️ New shopping job available!",
    body: `Shop from ${shopName} — ${shopAddress.slice(0, 50)}`,
    url: "/dashboard/driver/jobs/available",
    tag: `bfm-new-${deliveryId}`,
    data: { deliveryId },
  })
}

// ── Driver: BFM stage transitions ─────────────────────────────────────────────

export type BfmStage =
  | "heading_to_shop"
  | "arrived_at_shop"
  | "shopping"
  | "purchase_completed"
  | "heading_to_customer"

const VALID_BFM_TRANSITIONS: Record<string, BfmStage[]> = {
  accepted: ["heading_to_shop"],
  heading_to_shop: ["arrived_at_shop"],
  arrived_at_shop: ["shopping"],
  shopping: ["purchase_completed"],
  purchase_completed: ["heading_to_customer"],
  heading_to_customer: [],
}

export async function updateBfmStage(
  deliveryId: string,
  newStage: BfmStage
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  const { data: delivery } = await admin
    .from("delivery_requests")
    .select("id, driver_id, service_type, status, bfm_stage, customer_id, tracking_number, shop_name")
    .eq("id", deliveryId)
    .single()

  if (!delivery) return { error: "Order not found" }
  if (delivery.driver_id !== user.id) return { error: "Not your job" }
  if (delivery.service_type !== "buy_for_me") return { error: "Not a Buy for Me order" }

  const currentStage = delivery.bfm_stage ?? delivery.status
  const allowed = VALID_BFM_TRANSITIONS[currentStage] ?? []
  if (!allowed.includes(newStage)) {
    return { error: `Cannot move from ${currentStage} to ${newStage}` }
  }

  // When starting journey to customer, update main status to in_transit
  const updates: Record<string, unknown> = { bfm_stage: newStage }
  if (newStage === "heading_to_customer") {
    updates.status = "in_transit"
  }
  if (newStage === "shopping") {
    updates.status = "collected" // reuse collected to indicate "at shop / shopping"
  }

  await admin
    .from("delivery_requests")
    .update(updates)
    .eq("id", deliveryId)

  // Notify customer
  const stageMessages: Record<BfmStage, { title: string; body: string }> = {
    heading_to_shop: {
      title: "Driver heading to shop",
      body: `Your driver is on the way to ${delivery.shop_name ?? "the shop"}.`,
    },
    arrived_at_shop: {
      title: "Driver arrived at shop",
      body: `Your driver has arrived at ${delivery.shop_name ?? "the shop"} and is getting ready to shop.`,
    },
    shopping: {
      title: "Shopping in progress",
      body: "Your driver is now shopping for your items.",
    },
    purchase_completed: {
      title: "Purchase completed",
      body: "Your driver has finished shopping and is preparing to deliver.",
    },
    heading_to_customer: {
      title: "Driver on the way",
      body: "Your order has been purchased and your driver is heading to you.",
    },
  }

  const msg = stageMessages[newStage]
  notifyUser({
    userId: delivery.customer_id,
    title: msg.title,
    body: msg.body,
    url: `/dashboard/customer/tracking/${delivery.tracking_number}`,
    tag: `bfm-stage-${deliveryId}`,
  }).catch(console.error)

  revalidatePath(`/dashboard/driver/jobs/${deliveryId}`)
  return {}
}

// ── Driver: Item management ───────────────────────────────────────────────────

export async function markItemFound(itemId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  const { data: item } = await admin
    .from("shopping_items")
    .select("id, delivery_id")
    .eq("id", itemId)
    .single()

  if (!item) return { error: "Item not found" }

  await admin.from("shopping_items").update({ status: "purchased" }).eq("id", itemId)
  revalidatePath(`/dashboard/driver`)
  return {}
}

export async function markItemUnavailable(itemId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  await admin.from("shopping_items").update({ status: "unavailable" }).eq("id", itemId)
  revalidatePath(`/dashboard/driver`)
  return {}
}

export async function requestSubstitution(params: {
  shopping_item_id: string
  delivery_id: string
  suggested_name: string
  suggested_price?: number
  driver_notes?: string
  photo_url?: string
}): Promise<{ error?: string; data?: { id: string } }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()

  // Verify driver is assigned
  const { data: delivery } = await admin
    .from("delivery_requests")
    .select("customer_id, tracking_number, shop_name, driver_id")
    .eq("id", params.delivery_id)
    .single()

  if (!delivery || delivery.driver_id !== user.id) return { error: "Not your job" }

  const { data: sub, error } = await admin
    .from("shopping_substitutions")
    .insert({
      shopping_item_id: params.shopping_item_id,
      delivery_id: params.delivery_id,
      driver_id: user.id,
      suggested_name: params.suggested_name,
      suggested_price: params.suggested_price || null,
      driver_notes: params.driver_notes || null,
      photo_url: params.photo_url || null,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  // Mark item as substituted pending approval
  await admin.from("shopping_items").update({ status: "substituted" }).eq("id", params.shopping_item_id)

  // Notify customer
  notifyUser({
    userId: delivery.customer_id,
    title: "Item substitution requested",
    body: `Your driver suggests replacing an item with "${params.suggested_name}". Tap to review.`,
    url: `/dashboard/customer/active-deliveries`,
    tag: `bfm-sub-${params.shopping_item_id}`,
  }).catch(console.error)

  revalidatePath("/dashboard/driver")
  revalidatePath("/dashboard/customer/active-deliveries")
  return { data: { id: sub.id } }
}

// ── Customer: Respond to substitution ────────────────────────────────────────

export async function respondToSubstitution(
  substitutionId: string,
  approved: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  const { data: sub } = await admin
    .from("shopping_substitutions")
    .select("id, shopping_item_id, delivery_id, driver_id, suggested_name")
    .eq("id", substitutionId)
    .single()

  if (!sub) return { error: "Substitution not found" }

  // Verify it's the customer's order
  const { data: delivery } = await admin
    .from("delivery_requests")
    .select("customer_id, tracking_number")
    .eq("id", sub.delivery_id)
    .single()

  if (!delivery || delivery.customer_id !== user.id) return { error: "Not your order" }

  await admin
    .from("shopping_substitutions")
    .update({ customer_approved: approved, customer_responded_at: new Date().toISOString() })
    .eq("id", substitutionId)

  // Update item status
  const itemStatus = approved ? "substituted" : "unavailable"
  await admin.from("shopping_items").update({ status: itemStatus }).eq("id", sub.shopping_item_id)

  // Notify driver
  notifyUser({
    userId: sub.driver_id,
    title: approved ? "Substitution approved" : "Substitution rejected",
    body: approved
      ? `Customer approved replacing with "${sub.suggested_name}".`
      : `Customer rejected the substitution for "${sub.suggested_name}". Please mark the item unavailable.`,
    url: `/dashboard/driver/jobs/${sub.delivery_id}`,
    tag: `bfm-sub-response-${substitutionId}`,
  }).catch(console.error)

  revalidatePath("/dashboard/customer/active-deliveries")
  return {}
}

// ── Driver: Submit purchase receipt ─────────────────────────────────────────

export async function submitPurchaseReceipt(params: {
  deliveryId: string
  receipt_url: string
  actual_items_total: number
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  const { data: delivery } = await admin
    .from("delivery_requests")
    .select("id, driver_id, customer_id, max_spend_approved, tracking_number, shop_name")
    .eq("id", params.deliveryId)
    .single()

  if (!delivery) return { error: "Order not found" }
  if (delivery.driver_id !== user.id) return { error: "Not your job" }

  const maxSpend = delivery.max_spend_approved ?? 50
  if (params.actual_items_total > maxSpend) {
    return {
      error: `Actual total £${params.actual_items_total.toFixed(2)} exceeds approved limit £${maxSpend.toFixed(2)}. You need customer approval first.`,
    }
  }

  await admin
    .from("delivery_requests")
    .update({
      receipt_url: params.receipt_url,
      actual_items_total: params.actual_items_total,
      purchase_confirmed_at: new Date().toISOString(),
      bfm_stage: "purchase_completed",
    })
    .eq("id", params.deliveryId)

  // Reconcile wallet: held max_spend - actual = refund to customer
  const refund = parseFloat((maxSpend - params.actual_items_total).toFixed(2))
  if (refund > 0) {
    await admin.rpc("increment_wallet_balance", { p_user_id: delivery.customer_id, p_amount: refund })
    await admin.from("wallet_transactions").insert({
      user_id: delivery.customer_id,
      type: "cashback",
      amount: refund,
      description: `Buy for Me shopping refund (unspent) - ${delivery.tracking_number}`,
      delivery_id: params.deliveryId,
    })
  }

  // Notify customer
  notifyUser({
    userId: delivery.customer_id,
    title: "Purchase completed",
    body: `Your driver spent £${params.actual_items_total.toFixed(2)} at ${delivery.shop_name ?? "the shop"}.${refund > 0 ? ` £${refund.toFixed(2)} returned to your wallet.` : ""}`,
    url: `/dashboard/customer/active-deliveries`,
    tag: `bfm-purchased-${params.deliveryId}`,
  }).catch(console.error)

  revalidatePath(`/dashboard/driver/jobs/${params.deliveryId}`)
  revalidatePath("/dashboard/customer/active-deliveries")
  return {}
}

// ── Customer: Get shopping items for a delivery ───────────────────────────────

export async function getShoppingItems(deliveryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] as ShoppingItemRow[], error: "Not authenticated" }

  const admin = createAdminClient()
  // Verify access
  const { data: delivery } = await admin
    .from("delivery_requests")
    .select("customer_id, driver_id")
    .eq("id", deliveryId)
    .single()

  if (!delivery) return { data: [] as ShoppingItemRow[], error: "Not found" }
  if (delivery.customer_id !== user.id && delivery.driver_id !== user.id) {
    // Check admin
    const { data: profile } = await admin.from("users").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return { data: [] as ShoppingItemRow[], error: "Unauthorised" }
  }

  const { data, error } = await admin
    .from("shopping_items")
    .select("*")
    .eq("delivery_id", deliveryId)
    .order("created_at", { ascending: true })

  if (error) return { data: [] as ShoppingItemRow[], error: error.message }
  return { data: (data ?? []) as ShoppingItemRow[], error: null }
}

export type ShoppingItemRow = {
  id: string
  delivery_id: string
  name: string
  quantity: number
  estimated_price: number | null
  actual_price: number | null
  brand_size_variant: string | null
  notes: string | null
  photo_url: string | null
  substitution_preference: string
  status: string
  created_at: string
}

// ── Admin: Get BFM order details ──────────────────────────────────────────────

export async function getShoppingSubstitutions(deliveryId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("shopping_substitutions")
    .select("*")
    .eq("delivery_id", deliveryId)
    .order("created_at", { ascending: true })
  if (error) return { data: [], error: error.message }
  return { data: data ?? [], error: null }
}

// ── Quote helper ─────────────────────────────────────────────────────────────

export type ShoppingQuoteParams = {
  shop_lat: number
  shop_lng: number
  delivery_lat: number
  delivery_lng: number
  estimated_items_total?: number
  promo_code?: string | null
}

export type ShoppingQuote = {
  deliveryFee: number
  serviceFee: number
  totalFee: number
  itemsHold: number
  totalCharge: number
  estimatedItemsTotal: number
  maxSpendLimit: number
  distanceMiles: number
  durationMin: number
  promoCodeError: string | null
}

export async function getShoppingQuote(
  params: ShoppingQuoteParams
): Promise<{ data: ShoppingQuote } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const bfm = await getBfmSettings()
  if (!bfm.enabled) return { error: "Buy for Me is currently unavailable." }

  const quoteResult = await getDeliveryQuote({
    pickupLat: params.shop_lat,
    pickupLng: params.shop_lng,
    deliveryLat: params.delivery_lat,
    deliveryLng: params.delivery_lng,
    packageSize: "medium",
    promoCode: params.promo_code,
  })

  if ("error" in quoteResult) return { error: quoteResult.error }
  const quote = quoteResult.data

  const serviceFee = parseFloat((quote.finalPrice * (bfm.service_fee_percentage / 100)).toFixed(2))
  const deliveryFee = parseFloat((quote.finalPrice + serviceFee).toFixed(2))
  const estimatedItems = params.estimated_items_total ?? 0
  const itemsHold = bfm.max_purchase_amount

  return {
    data: {
      deliveryFee: quote.finalPrice,
      serviceFee,
      totalFee: deliveryFee,
      itemsHold,
      totalCharge: parseFloat((deliveryFee + itemsHold).toFixed(2)),
      estimatedItemsTotal: estimatedItems,
      maxSpendLimit: bfm.max_purchase_amount,
      distanceMiles: quote.distanceMiles,
      durationMin: quote.durationMin,
      promoCodeError: quote.promoCodeError,
    },
  }
}
