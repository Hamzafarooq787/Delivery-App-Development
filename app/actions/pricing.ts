/**
 * app/actions/pricing.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * getDeliveryQuote() is the SINGLE authoritative source of delivery pricing —
 * called both for live preview while the customer fills out the form, and
 * again (with identical inputs) inside createDeliveryRequest() right before
 * charging the wallet. The client never supplies a price; it only supplies
 * pickup/delivery coordinates, package size, and an optional promo code.
 *
 * Surge pricing combines three factors via MAX (see lib/pricing.ts), capped
 * by admin-configured max_total_multiplier:
 *   - Busy periods: admin-configured day/time rules
 *   - High demand: live ratio of pending orders to online+approved drivers
 *   - Heavy traffic: Google Maps traffic-aware duration vs static duration
 * Weather-based surge is intentionally not implemented (no weather API
 * connected yet — can be added as a fourth factor later).
 */
"use server"

import { integrationBudget } from "@/lib/integration-access"
import { bookingAvailability } from "@/lib/booking-availability"
import { runAdminMutation } from "@/lib/admin-access"
import { getAdminActor } from "@/lib/admin-access"
import { SURGE_COLUMNS, surgeSettingsSchema, busyPeriodSchema } from "@/lib/admin-pricing-validation"
import { issueQuoteConsent, deliveryScope } from "@/lib/quote-consent"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { fetchRouteServer } from "@/lib/google-server"
import { matchingBusyPeriodRules, combineSurgeFactors, type BusyPeriodRule, type SurgeFactor } from "@/lib/pricing"
import { getBookingPricing } from "@/app/actions/booking-settings"
import { calculateDeliveryFare, fareBreakdown, inServiceArea, type BookingPricing } from "@/lib/booking-pricing"
import { resolveDiscount } from "@/app/actions/promotions"
import { isPackageSize, type PackageSize } from "@/lib/vehicles"

export type DeliveryQuote = {
  priceLines: {label:string;amount:number}[]
  discountCampaign?: string | null
  consentToken: string
  distanceMiles: number
  durationMin: number
  basePrice: number
  surgeMultiplier: number
  surgeFactors: SurgeFactor[]
  surgedPrice: number
  discountAmount: number
  discountLabel: string | null
  /** Set when a promo code was entered but is invalid/expired/exhausted — the quote still computes with no discount, but the client should show this. */
  promoCodeError: string | null
  promoCodeId: string | null
  promoCodeText: string | null
  finalPrice: number
}

export type QuoteParams = {
  serviceType?: "delivery" | "buy_for_me"
  pickupLat: number
  pickupLng: number
  deliveryLat: number
  deliveryLng: number
  packageSize: PackageSize
  promoCode?: string | null
}

export async function getDeliveryQuote(params: QuoteParams): Promise<{ data: DeliveryQuote } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const availability = await bookingAvailability(user.id,params.serviceType??"delivery",{lat:params.pickupLat,lng:params.pickupLng},{lat:params.deliveryLat,lng:params.deliveryLng})
  if(availability)return {error:availability}
  if (!isPackageSize(params.packageSize)) return { error: "Select a package size." }

  let config: BookingPricing
  try { config = await getBookingPricing() } catch { return { error: "Pricing settings unavailable. Please retry." } }
  if (!inServiceArea(params.pickupLat, params.pickupLng, config.serviceRadiusMiles) || !inServiceArea(params.deliveryLat, params.deliveryLng, config.serviceRadiusMiles)) return { error: "Both addresses must be within our service area. Contact support for coverage." }
  const budget = await integrationBudget(user.id,"maps")
  if (budget) return {error:budget.error}
  const route = await fetchRouteServer(
    { lat: params.pickupLat, lng: params.pickupLng },
    { lat: params.deliveryLat, lng: params.deliveryLng }
  )
  if (!route) return { error: "Could not calculate a route for this pickup/delivery pair. Please check the addresses." }

  const basePrice = calculateDeliveryFare(route.distance_miles, config, params.packageSize)

  const admin = createAdminClient()
  const [surgeSettingsRes, busyRulesRes, onlineDriversRes, pendingOrdersRes] = await Promise.all([
    admin.from("surge_pricing_settings").select(SURGE_COLUMNS).eq("id", true).maybeSingle(),
    admin.from("busy_period_rules").select("*").eq("active", true),
    admin.from("driver_profiles").select("id", { count: "exact", head: true }).eq("status", "approved").eq("is_online", true),
    admin.from("delivery_requests").select("id", { count: "exact", head: true }).eq("status", "requested"),
  ])

  if (surgeSettingsRes.error || busyRulesRes.error || onlineDriversRes.error || pendingOrdersRes.error || !surgeSettingsRes.data) return { error: "Pricing is unavailable. Please retry." }
  const surgeSettings = surgeSettingsRes.data
  const surgeFactorsRaw: SurgeFactor[] = []

  if (surgeSettings?.master_enabled) {
    const busyMatches = matchingBusyPeriodRules((busyRulesRes.data ?? []) as BusyPeriodRule[], new Date())
    for (const rule of busyMatches) {
      surgeFactorsRaw.push({ label: `Busy period — ${rule.label}`, multiplier: Number(rule.multiplier) })
    }

    if (surgeSettings.demand_enabled) {
      const onlineDrivers = onlineDriversRes.count ?? 0
      const pendingOrders = pendingOrdersRes.count ?? 0
      if (onlineDrivers > 0) {
        const ratio = pendingOrders / onlineDrivers
        if (ratio >= Number(surgeSettings.demand_threshold_ratio)) {
          surgeFactorsRaw.push({ label: "High demand", multiplier: Number(surgeSettings.demand_multiplier) })
        }
      } else if (pendingOrders > 0) {
        // No drivers online at all but orders are pending — treat as high demand
        surgeFactorsRaw.push({ label: "High demand", multiplier: Number(surgeSettings.demand_multiplier) })
      }
    }

    if (surgeSettings.traffic_enabled && route.duration_in_traffic_min != null && route.duration_min > 0) {
      const ratio = route.duration_in_traffic_min / route.duration_min
      if (ratio >= Number(surgeSettings.traffic_threshold_ratio)) {
        surgeFactorsRaw.push({ label: "Heavy traffic", multiplier: Number(surgeSettings.traffic_multiplier) })
      }
    }
  }

  const maxTotalMultiplier = surgeSettings ? Number(surgeSettings.max_total_multiplier) : 1
  const { multiplier: surgeMultiplier, factors: surgeFactors } = surgeSettings?.master_enabled
    ? combineSurgeFactors(surgeFactorsRaw, maxTotalMultiplier)
    : { multiplier: 1, factors: [] }

  const surgedPrice = Math.round(basePrice * surgeMultiplier * 100) / 100

  const discount = await resolveDiscount(user.id, params.promoCode ?? null, surgedPrice)
  // A promo-code error is surfaced but doesn't block the quote — the price
  // just reflects no discount, and the client shows the error inline.
  const discountAmount = discount.error ? 0 : discount.discountAmount

  const finalPrice = Math.round((surgedPrice - discountAmount) * 100) / 100

  return {
    data: {
      consentToken: issueQuoteConsent(user.id, deliveryScope(params), finalPrice),
      distanceMiles: route.distance_miles,
      durationMin: Math.ceil(route.duration_min),
      priceLines: fareBreakdown(route.distance_miles,config,params.packageSize),
      basePrice,
      surgeMultiplier,
      surgeFactors,
      surgedPrice,
      discountAmount,
      discountCampaign: discount.campaign ?? null,
      discountLabel: discount.error ? null : discount.discountLabel,
      promoCodeError: discount.error ?? null,
      promoCodeId: discount.error ? null : discount.promoCodeId,
      promoCodeText: discount.error ? null : discount.promoCodeText,
      finalPrice,
    },
  }
}

// ── Admin: surge pricing settings ───────────────────────────────────────────────

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
  return !!(await getAdminActor("settings"))
}

export type SurgeSettings = {
  master_enabled: boolean
  demand_enabled: boolean
  demand_threshold_ratio: number
  demand_multiplier: number
  traffic_enabled: boolean
  traffic_threshold_ratio: number
  traffic_multiplier: number
  max_total_multiplier: number
}

export async function adminGetSurgeSettings(): Promise<{ data: SurgeSettings | null; error?: string }> {
  if (!(await requireAdmin())) return { data: null, error: "Not authorized" }
  const admin = createAdminClient()
  const { data, error } = await admin.from("surge_pricing_settings").select(SURGE_COLUMNS).eq("id", true).maybeSingle()
  if (error) return { data: null, error: error.message }
  return { data: data as SurgeSettings | null }
}

export async function adminUpdateSurgeSettings(settings: SurgeSettings): Promise<{ success?: boolean; error?: string }> {
 return runAdminMutation("settings","adminUpdateSurgeSettings",settings,async()=>{
  if (!(await requireAdmin())) return { error: "Not authorized" }
  const parsed = surgeSettingsSchema.safeParse(settings)
  if (!parsed.success) return { error: "Enter valid surge settings. Multipliers must be between 1 and 10; demand ratio 0.1–100 and traffic ratio 1–10." }
  const admin = createAdminClient()
  const { error } = await admin
    .from("surge_pricing_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", true).select("id").single()
  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/promotions")
  return { success: true }

 })
}

// ── Admin: busy period rules ─────────────────────────────────────────────────────

export type BusyPeriodRuleRow = BusyPeriodRule & { id: string }

export async function adminGetBusyPeriodRules(): Promise<{ data: BusyPeriodRuleRow[]; error?: string }> {
  if (!(await requireAdmin())) return { data: [], error: "Not authorized" }
  const admin = createAdminClient()
  const { data, error } = await admin.from("busy_period_rules").select("*").order("created_at", { ascending: false })
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as BusyPeriodRuleRow[] }
}

export type BusyPeriodRuleInput = {
  label: string
  day_of_week: number | null
  start_time: string
  end_time: string
  multiplier: number
  active: boolean
}

export async function adminCreateBusyPeriodRule(input: BusyPeriodRuleInput): Promise<{ success?: boolean; data?: BusyPeriodRuleRow; error?: string }> {
 return runAdminMutation("settings","adminCreateBusyPeriodRule",input,async()=>{
  if (!(await requireAdmin())) return { error: "Not authorized" }
  const parsed = busyPeriodSchema.safeParse(input)
  if (!parsed.success) return { error: "Enter a label, valid times, day and a multiplier between 1 and 10." }

  const admin = createAdminClient()
  const { data, error } = await admin.from("busy_period_rules").insert(parsed.data).select("id,label,day_of_week,start_time,end_time,multiplier,active").single()
  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/promotions")
  return { success: true, data: data as BusyPeriodRuleRow }

 })
}

export async function adminUpdateBusyPeriodRule(id: string, input: BusyPeriodRuleInput): Promise<{ success?: boolean; data?: BusyPeriodRuleRow; error?: string }> {
 return runAdminMutation("settings","adminUpdateBusyPeriodRule",id,async()=>{
  if (!(await requireAdmin())) return { error: "Not authorized" }
  const parsed = busyPeriodSchema.safeParse(input)
  if (!parsed.success) return { error: "Enter a label, valid times, day and a multiplier between 1 and 10." }

  const admin = createAdminClient()
  const { data, error } = await admin.from("busy_period_rules").update(parsed.data).eq("id", id).select("id,label,day_of_week,start_time,end_time,multiplier,active").single()
  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/promotions")
  return { success: true, data: data as BusyPeriodRuleRow }

 })
}

export async function adminDeleteBusyPeriodRule(id: string): Promise<{ success?: boolean; error?: string }> {
 return runAdminMutation("settings","adminDeleteBusyPeriodRule",id,async()=>{
  if (!(await requireAdmin())) return { error: "Not authorized" }
  const admin = createAdminClient()
  const { error } = await admin.from("busy_period_rules").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/promotions")
  return { success: true }

 })
}
