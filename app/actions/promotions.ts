/**
 * app/actions/promotions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Discount resolution (used by the pricing engine, app/actions/pricing.ts)
 * plus admin CRUD for promo codes and automatic discount configuration.
 *
 * Discount priority: an explicitly entered, valid promo code always wins
 * (the customer's explicit choice). If no code is entered (or the entered
 * code is invalid), automatic eligibility is checked instead — first-order
 * takes priority over loyalty since it's the larger one-time incentive.
 * Discounts never stack.
 */
"use server"

import { runAdminMutation } from "@/lib/admin-access"
import { getAdminActor } from "@/lib/admin-access"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

// ── Types ─────────────────────────────────────────────────────────────────────

export type PromoCode = {
  id: string
  code: string
  description: string | null
  discount_type: "percentage" | "fixed"
  discount_value: number
  max_discount_amount: number | null
  min_order_value: number | null
  usage_limit_total: number | null
  usage_limit_per_user: number
  valid_from: string
  valid_until: string | null
  active: boolean
  created_at: string
}

export type AutomaticDiscount = {
  type: "first_order" | "loyalty"
  active: boolean
  discount_type: "percentage" | "fixed"
  discount_value: number
  max_discount_amount: number | null
  loyalty_order_threshold: number | null
}

export type DiscountResult = {
  campaign?: string | null
  discountAmount: number
  discountLabel: string | null
  promoCodeId: string | null
  promoCodeText: string | null
  error?: string
}

// ── Discount computation (internal — used by the pricing engine) ──────────────

function applyDiscount(
  discountType: "percentage" | "fixed",
  discountValue: number,
  maxDiscountAmount: number | null,
  subtotal: number
): number {
  let discount = discountType === "percentage" ? subtotal * (discountValue / 100) : discountValue
  if (maxDiscountAmount != null) discount = Math.min(discount, maxDiscountAmount)
  // Never let a discount bring the price below £1
  discount = Math.min(discount, Math.max(0, subtotal - 1))
  return Math.max(0, Math.round(discount * 100) / 100)
}

export async function resolveDiscount(
  customerId: string,
  promoCode: string | null,
  subtotal: number
): Promise<DiscountResult> {
  const admin = createAdminClient()
  const empty: DiscountResult = { discountAmount: 0, discountLabel: null, promoCodeId: null, promoCodeText: null }

  if (promoCode && promoCode.trim()) {
    const code = promoCode.trim().toUpperCase()
    const { data: promo } = await admin
      .from("promo_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle()

    if (!promo) return { ...empty, error: "Invalid promo code" }
    if (!promo.active) return { ...empty, error: "This promo code is no longer active" }

    const now = new Date()
    if (new Date(promo.valid_from) > now) return { ...empty, error: "This promo code isn't active yet" }
    if (promo.valid_until && new Date(promo.valid_until) < now) return { ...empty, error: "This promo code has expired" }
    if (promo.min_order_value != null && subtotal < promo.min_order_value) {
      return { ...empty, error: `Minimum order of £${promo.min_order_value.toFixed(2)} required for this code` }
    }

    if (promo.usage_limit_total != null) {
      const { count } = await admin
        .from("promo_code_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("promo_code_id", promo.id)
      if ((count ?? 0) >= promo.usage_limit_total) return { ...empty, error: "This promo code has reached its usage limit" }
    }

    const { count: userCount } = await admin
      .from("promo_code_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("promo_code_id", promo.id)
      .eq("user_id", customerId)
    if ((userCount ?? 0) >= promo.usage_limit_per_user) return { ...empty, error: "You've already used this promo code" }

    const discountAmount = applyDiscount(promo.discount_type, promo.discount_value, promo.max_discount_amount, subtotal)
    return {
      discountAmount,
      discountLabel: promo.description || `Promo code ${code}`,
      promoCodeId: promo.id,
      promoCodeText: code,
    }
  }

  // No code entered — check automatic discount eligibility.
  const { data: autoDiscounts } = await admin.from("automatic_discounts").select("*").eq("active", true)
  const firstOrder = autoDiscounts?.find((d) => d.type === "first_order")
  const loyalty = autoDiscounts?.find((d) => d.type === "loyalty")

  if (firstOrder) {
    const { count } = await admin
      .from("delivery_requests")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId)
    if ((count ?? 0) === 0) {
      const discountAmount = applyDiscount(firstOrder.discount_type, firstOrder.discount_value, firstOrder.max_discount_amount, subtotal)
      if (discountAmount > 0) return { discountAmount, discountLabel: "First delivery discount", campaign: "first_order", promoCodeId: null, promoCodeText: null }
    }
  }

  if (loyalty && loyalty.loyalty_order_threshold) {
    const { count } = await admin
      .from("delivery_requests")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .eq("status", "delivered")
    const delivered = count ?? 0
    if (delivered > 0 && delivered % loyalty.loyalty_order_threshold === 0) {
      const discountAmount = applyDiscount(loyalty.discount_type, loyalty.discount_value, loyalty.max_discount_amount, subtotal)
      if (discountAmount > 0) {
        return {
          discountAmount,
          discountLabel: `Loyalty reward — thanks for ${delivered} deliveries!`,
          campaign: `loyalty:${delivered}`,
          promoCodeId: null,
          promoCodeText: null,
        }
      }
    }
  }

  return empty
}

// ── Admin: promo codes ─────────────────────────────────────────────────────────

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
  return !!(await getAdminActor("settings"))
}

export async function adminGetPromoCodes(): Promise<{ data: PromoCode[]; error?: string }> {
  if (!(await requireAdmin())) return { data: [], error: "Not authorized" }
  const admin = createAdminClient()
  const { data, error } = await admin.from("promo_codes").select("*").order("created_at", { ascending: false })
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as PromoCode[] }
}

export type PromoCodeInput = {
  code: string
  description: string
  discount_type: "percentage" | "fixed"
  discount_value: number
  max_discount_amount: number | null
  min_order_value: number | null
  usage_limit_total: number | null
  usage_limit_per_user: number
  valid_from: string
  valid_until: string | null
  active: boolean
}

export async function adminCreatePromoCode(input: PromoCodeInput): Promise<{ success?: boolean; error?: string }> {
 return runAdminMutation("settings","adminCreatePromoCode",input,async()=>{
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await requireAdmin())) return { error: "Not authorized" }

  const code = input.code.trim().toUpperCase()
  if (!code) return { error: "Code is required" }
  if (!input.discount_value || input.discount_value <= 0) return { error: "Discount value must be greater than 0" }

  const admin = createAdminClient()
  const { error } = await admin.from("promo_codes").insert({
    code,
    description: input.description.trim() || null,
    discount_type: input.discount_type,
    discount_value: input.discount_value,
    max_discount_amount: input.max_discount_amount,
    min_order_value: input.min_order_value,
    usage_limit_total: input.usage_limit_total,
    usage_limit_per_user: input.usage_limit_per_user || 1,
    valid_from: input.valid_from,
    valid_until: input.valid_until,
    active: input.active,
    created_by: user.id,
  })

  if (error) return { error: error.code === "23505" ? "A promo code with this code already exists" : error.message }
  revalidatePath("/dashboard/admin/promotions")
  return { success: true }

 })
}

export async function adminUpdatePromoCode(id: string, input: PromoCodeInput): Promise<{ success?: boolean; error?: string }> {
 return runAdminMutation("settings","adminUpdatePromoCode",id,async()=>{
  if (!(await requireAdmin())) return { error: "Not authorized" }

  const code = input.code.trim().toUpperCase()
  if (!code) return { error: "Code is required" }
  if (!input.discount_value || input.discount_value <= 0) return { error: "Discount value must be greater than 0" }

  const admin = createAdminClient()
  const { error } = await admin.from("promo_codes").update({
    code,
    description: input.description.trim() || null,
    discount_type: input.discount_type,
    discount_value: input.discount_value,
    max_discount_amount: input.max_discount_amount,
    min_order_value: input.min_order_value,
    usage_limit_total: input.usage_limit_total,
    usage_limit_per_user: input.usage_limit_per_user || 1,
    valid_from: input.valid_from,
    valid_until: input.valid_until,
    active: input.active,
  }).eq("id", id)

  if (error) return { error: error.code === "23505" ? "A promo code with this code already exists" : error.message }
  revalidatePath("/dashboard/admin/promotions")
  return { success: true }

 })
}

export async function adminDeletePromoCode(id: string): Promise<{ success?: boolean; error?: string }> {
 return runAdminMutation("settings","adminDeletePromoCode",id,async()=>{
  if (!(await requireAdmin())) return { error: "Not authorized" }
  const admin = createAdminClient()
  const { error } = await admin.from("promo_codes").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/promotions")
  return { success: true }

 })
}

// ── Admin: automatic discounts ──────────────────────────────────────────────────

export async function adminGetAutomaticDiscounts(): Promise<{ data: AutomaticDiscount[]; error?: string }> {
  if (!(await requireAdmin())) return { data: [], error: "Not authorized" }
  const admin = createAdminClient()
  const { data, error } = await admin.from("automatic_discounts").select("*").order("type")
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as AutomaticDiscount[] }
}

export async function adminUpdateAutomaticDiscount(discount: AutomaticDiscount): Promise<{ success?: boolean; error?: string }> {
 return runAdminMutation("settings","adminUpdateAutomaticDiscount",discount,async()=>{
  if (!(await requireAdmin())) return { error: "Not authorized" }
  if (!discount.discount_value || discount.discount_value <= 0) return { error: "Discount value must be greater than 0" }
  if (discount.type === "loyalty" && (!discount.loyalty_order_threshold || discount.loyalty_order_threshold <= 0)) {
    return { error: "Loyalty threshold must be greater than 0" }
  }

  const admin = createAdminClient()
  const { error } = await admin.from("automatic_discounts").update({
    active: discount.active,
    discount_type: discount.discount_type,
    discount_value: discount.discount_value,
    max_discount_amount: discount.max_discount_amount,
    loyalty_order_threshold: discount.type === "loyalty" ? discount.loyalty_order_threshold : null,
    updated_at: new Date().toISOString(),
  }).eq("type", discount.type)

  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/promotions")
  return { success: true }

 })
}
