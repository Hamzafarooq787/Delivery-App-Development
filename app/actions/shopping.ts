"use server"

import { issueQuoteConsent, checkQuoteConsent } from "@/lib/quote-consent"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { notifyUser, notifyMultipleUsers } from "@/lib/notifications/internal"
import { getBookingPricing } from "@/app/actions/booking-settings"
import { getDeliveryQuote } from "@/app/actions/pricing"
import { validateShoppingItems, normalizeBfmSettings } from "@/lib/shopping-validation"

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
  consent_token?: string
  request_key: string
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
  if (!data) throw new Error("Shopping settings could not be loaded. Please try again.")
  return normalizeBfmSettings(data)
}

export async function updateBfmSettings(settings: Partial<BfmSettings>): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }
  const { data: profile } = await createAdminClient().from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: "Unauthorised" }

  if (settings.enabled !== undefined && typeof settings.enabled !== "boolean") return { error: "Invalid service setting" }
  if (settings.max_purchase_amount !== undefined && (!Number.isFinite(settings.max_purchase_amount) || settings.max_purchase_amount <= 0 || settings.max_purchase_amount > 100)) return { error: "Shopping limit must be between £0.01 and £100" }
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
  let bfm: BfmSettings
  try { bfm = await getBfmSettings() } catch { return { error: "Shopping settings are unavailable. Please try again." } }
  if (!bfm.enabled) return { error: "Buy for Me is currently unavailable.", code: "bfm_disabled" }

  if (!params.request_key || !/^[0-9a-f-]{36}$/i.test(params.request_key)) return { error: "Please reopen the shopping form and retry." }
  const validationError = validateShoppingItems(params.shopping_items)
  if (validationError) return { error: validationError }
  if (!params.shop_name?.trim() || !params.shop_address?.trim() || !params.delivery_address?.trim()) return { error: "Enter the shop and delivery details." }
  if (![params.shop_lat, params.shop_lng, params.delivery_lat, params.delivery_lng].every(Number.isFinite) || Math.abs(params.shop_lat) > 90 || Math.abs(params.delivery_lat) > 90 || Math.abs(params.shop_lng) > 180 || Math.abs(params.delivery_lng) > 180) return { error: "Select valid shop and delivery locations." }
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
  const serviceFee = (await getBookingPricing()).shoppingFee
  const deliveryFee = parseFloat((quote.finalPrice + serviceFee).toFixed(2))

  // max_spend is the lower of the configured limit or the customer's estimate (if provided)
  const maxSpend = bfm.max_purchase_amount

  // Total wallet deduction at booking: delivery fee + items hold
  const totalCharge = parseFloat((deliveryFee + maxSpend).toFixed(2))

  if (!checkQuoteConsent(params.consent_token, user.id, [params.shop_lat, params.shop_lng, params.delivery_lat, params.delivery_lng, estimatedTotal], totalCharge)) return { error: "Your quote changed or expired. Go back and review the new price before confirming." }

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

  const { data: booking, error: rpcError } = await admin.rpc("book_shopping_order_atomic", {
    p_customer_id: user.id,
    p_request_key: params.request_key,
    p_order: { ...params, tracking_number, price: deliveryFee, base_price: quote.basePrice,
      service_fee: serviceFee, estimated_items_total: estimatedTotal, max_spend_approved: maxSpend,
      discount_amount: quote.discountAmount, surge_multiplier: quote.surgeMultiplier },
  })
  if (rpcError || !booking?.id) {
    console.error("[Shopping booking]", rpcError?.code, rpcError?.message)
    const insufficient = rpcError?.message?.includes("insufficient_funds")
    return { error: insufficient ? "Insufficient wallet funds. Add funds, then retry this saved request." : "Shopping could not be booked. Please retry. If this continues, contact support.", ...(insufficient ? { code: "insufficient_funds" as const } : {}) }
  }
  const deliveryIdStr = booking.id as string
  revalidatePath("/dashboard/customer")
  revalidatePath("/dashboard/customer/active-deliveries")
  revalidatePath("/dashboard/customer/wallet")

  // Notify online approved drivers
  if (!booking.replayed) notifyDriversOfNewShoppingJob(deliveryIdStr, params.shop_name, params.shop_address).catch(console.error)

  return { data: { id: deliveryIdStr, tracking_number: booking.tracking_number } }
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
  if (["cancelled", "delivered"].includes(delivery.status)) return { error: "Order is closed" }
  if (delivery.service_type !== "buy_for_me") return { error: "Not a Buy for Me order" }

  const currentStage = delivery.bfm_stage ?? delivery.status
  const allowed = VALID_BFM_TRANSITIONS[currentStage] ?? []
  if (!allowed.includes(newStage)) {
    return { error: `Cannot move from ${currentStage} to ${newStage}` }
  }

  if (newStage === "purchase_completed") return { error: "Submit the purchase receipt to complete shopping." }
  // When starting journey to customer, update main status to in_transit
  const updates: Record<string, unknown> = { bfm_stage: newStage }
  if (newStage === "heading_to_customer") {
    updates.status = "in_transit"
  }
  if (newStage === "shopping") {
    updates.status = "collected" // reuse collected to indicate "at shop / shopping"
  }

  const { data: changed, error: stageError } = await admin
    .from("delivery_requests")
    .update(updates)
    .eq("id", deliveryId)
    .eq("status", delivery.status)
    .select("id")
  if (stageError || !changed?.length) return { error: "Order changed. Refresh before trying again." }

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
    url: `/dashboard/customer/tracking?id=${deliveryId}`,
    tag: `bfm-stage-${deliveryId}`,
  }).catch(console.error)

  revalidatePath(`/dashboard/driver/jobs/${deliveryId}`)
  return {}
}

// ── Driver: Item management ───────────────────────────────────────────────────

async function changeItemStatus(itemId: string, status: "purchased" | "unavailable") {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }
  const admin = createAdminClient()
  const { data: item } = await admin.from("shopping_items").select("delivery_id").eq("id", itemId).single()
  if (!item) return { error: "Item not found" }
  const { data: order } = await admin.from("delivery_requests").select("driver_id,status,bfm_stage").eq("id", item.delivery_id).single()
  if (order?.driver_id !== user.id || order.status !== "collected" || order.bfm_stage !== "shopping") return { error: "Not your active shopping job" }
  const { error } = await admin.from("shopping_items").update({ status }).eq("id", itemId).eq("delivery_id", item.delivery_id)
  if (error) return { error: "Item could not be updated" }
  revalidatePath("/dashboard/driver")
  return {}
}
export async function markItemFound(itemId: string): Promise<{ error?: string }> { return changeItemStatus(itemId, "purchased") }
export async function markItemUnavailable(itemId: string): Promise<{ error?: string }> { return changeItemStatus(itemId, "unavailable") }

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
    .select("customer_id, tracking_number, shop_name, driver_id, status, bfm_stage")
    .eq("id", params.delivery_id)
    .single()

  if (!delivery || delivery.driver_id !== user.id || delivery.status !== "collected" || delivery.bfm_stage !== "shopping") return { error: "Not your active shopping job" }
  const { data: relatedItem } = await admin.from("shopping_items").select("id").eq("id", params.shopping_item_id).eq("delivery_id", params.delivery_id).maybeSingle()
  if (!relatedItem) return { error: "Item does not belong to this order" }
  if (params.suggested_price != null && (!Number.isFinite(params.suggested_price) || params.suggested_price < 0)) return { error: "Invalid replacement price" }

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
    .select("customer_id, tracking_number, status, bfm_stage")
    .eq("id", sub.delivery_id)
    .single()

  if (!delivery || delivery.customer_id !== user.id) return { error: "Not your order" }

  if (delivery.status !== "collected" || delivery.bfm_stage !== "shopping" || typeof approved !== "boolean") return { error: "This order is no longer awaiting a shopping decision." }
  const { error: decisionError } = await admin.rpc("decide_shopping_substitution", { p_id: substitutionId, p_customer_id: user.id, p_approved: approved })
  if (decisionError) return { error: "This decision could not be saved. Refresh the order and retry." }

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

  if (!Number.isFinite(params.actual_items_total) || params.actual_items_total < 0 || params.actual_items_total > Number(delivery.max_spend_approved)) return { error: "Enter a valid total within the approved shopping budget." }
  const receiptPath = receiptObjectPath(params.receipt_url)
  if (!receiptPath || !receiptPath.startsWith(`${user.id}/receipts/${params.deliveryId}/`)) return { error: "Upload a receipt for this order first." }
  const { data: objects, error: storageError } = await admin.storage.from("delivery-item-photos").list(`${user.id}/receipts/${params.deliveryId}`)
  if (storageError || !objects?.some(o => o.name === receiptPath.split("/").at(-1))) return { error: "Receipt upload could not be verified." }
  const { data: settlement, error } = await admin.rpc("settle_shopping_receipt_atomic", { p_delivery_id: params.deliveryId, p_driver_id: user.id, p_receipt_url: params.receipt_url, p_actual_total: params.actual_items_total })
  if (error) return { error: "Purchase could not be settled. Check approvals and the receipt, then retry." }
  if (settlement?.replayed) return {}
  const refund = Number(settlement?.refund ?? 0)
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
  const access = await getShoppingItems(deliveryId)
  if (access.error) return { data: [], error: access.error }
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
  consentToken: string
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

  let bfm: BfmSettings
  try { bfm = await getBfmSettings() } catch { return { error: "Shopping settings are unavailable. Please try again." } }
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

  const serviceFee = (await getBookingPricing()).shoppingFee
  const deliveryFee = parseFloat((quote.finalPrice + serviceFee).toFixed(2))
  const estimatedItems = params.estimated_items_total ?? 0
  const itemsHold = bfm.max_purchase_amount

  return {
    data: {
      consentToken: issueQuoteConsent(user.id, [params.shop_lat, params.shop_lng, params.delivery_lat, params.delivery_lng, estimatedItems], parseFloat((deliveryFee + itemsHold).toFixed(2))),
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

function receiptObjectPath(url: string): string | null {
  try {
    const parsed = new URL(url)
    const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin
    const prefix = "/storage/v1/object/public/delivery-item-photos/"
    return parsed.origin === origin && parsed.pathname.startsWith(prefix) ? decodeURIComponent(parsed.pathname.slice(prefix.length)) : null
  } catch { return null }
}
