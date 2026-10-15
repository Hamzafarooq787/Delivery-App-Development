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

import { readLaunchSettings } from "@/lib/launch-settings"
import { inServiceArea } from "@/lib/launch-pricing"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { fetchRouteServer } from "@/lib/google-server"
import { getBasePrice, matchingBusyPeriodRules, combineSurgeFactors, type BusyPeriodRule, type SurgeFactor } from "@/lib/pricing"
import { resolveDiscount } from "@/app/actions/promotions"
import { isPackageSize, type PackageSize } from "@/lib/vehicles"

export type DeliveryQuote = {
  extraCharges?: {label:string;amount:number}[]
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

  if (!isPackageSize(params.packageSize)) return { error: "Select a package size." }

  const launch = await readLaunchSettings()
  if (!inServiceArea(params.pickupLat,params.pickupLng,launch) || !inServiceArea(params.deliveryLat,params.deliveryLng,launch)) return {error:`Both addresses must be within the ${launch.areaName} service area.`}
  const route = await fetchRouteServer(
    { lat: params.pickupLat, lng: params.pickupLng },
    { lat: params.deliveryLat, lng: params.deliveryLng }
  )
  if (!route) return { error: "Could not calculate a route for this pickup/delivery pair. Please check the addresses." }

  const extraCharges: {label:string;amount:number}[]=[]
  if(params.packageSize==='bulky'&&launch.vanCharge>0)extraCharges.push({label:'Van delivery',amount:launch.vanCharge})
  if(params.packageSize==='large'&&launch.heavyCharge>0)extraCharges.push({label:'Large/heavy item',amount:launch.heavyCharge})
  const basePrice = getBasePrice(route.distance_miles, launch) + extraCharges.reduce((sum,c)=>sum+c.amount,0)

  const admin = createAdminClient()
  const [surgeSettingsRes, busyRulesRes, onlineDriversRes, pendingOrdersRes] = await Promise.all([
    admin.from("surge_pricing_settings").select("*").eq("id", true).maybeSingle(),
    admin.from("busy_period_rules").select("*").eq("active", true),
    admin.from("driver_profiles").select("id", { count: "exact", head: true }).eq("status", "approved").eq("is_online", true),
    admin.from("delivery_requests").select("id", { count: "exact", head: true }).eq("status", "requested"),
  ])

  const surgeSettings = surgeSettingsRes.data
  const surgeFactorsRaw: SurgeFactor[] = []
  if (launch.weatherMultiplier > 1) surgeFactorsRaw.push({label:"Weather surcharge",multiplier:launch.weatherMultiplier})
  if (launch.busyMultiplier > 1) surgeFactorsRaw.push({label:"Busy-period surcharge",multiplier:launch.busyMultiplier})

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

  const maxTotalMultiplier = Math.max(surgeSettings ? Number(surgeSettings.max_total_multiplier) : 1,launch.busyMultiplier,launch.weatherMultiplier)
  const { multiplier: surgeMultiplier, factors: surgeFactors } = (surgeSettings?.master_enabled || launch.weatherMultiplier > 1 || launch.busyMultiplier > 1)
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
      extraCharges,
      distanceMiles: route.distance_miles,
      durationMin: route.duration_min,
      basePrice,
      surgeMultiplier,
      surgeFactors,
      surgedPrice,
      discountAmount,
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
  return data?.role === "admin"
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
  const { data, error } = await admin.from("surge_pricing_settings").select("*").eq("id", true).maybeSingle()
  if (error) return { data: null, error: error.message }
  return { data: data as SurgeSettings | null }
}

export async function adminUpdateSurgeSettings(settings: SurgeSettings): Promise<{ success?: boolean; error?: string }> {
  if (!(await requireAdmin())) return { error: "Not authorized" }
  const admin = createAdminClient()
  const { error } = await admin
    .from("surge_pricing_settings")
    .update({ ...settings, updated_at: new Date().toISOString() })
    .eq("id", true)
  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/promotions")
  return { success: true }
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

export async function adminCreateBusyPeriodRule(input: BusyPeriodRuleInput): Promise<{ success?: boolean; error?: string }> {
  if (!(await requireAdmin())) return { error: "Not authorized" }
  if (!input.label.trim()) return { error: "Label is required" }
  if (!input.multiplier || input.multiplier < 1) return { error: "Multiplier must be at least 1.0" }

  const admin = createAdminClient()
  const { error } = await admin.from("busy_period_rules").insert({ ...input, label: input.label.trim() })
  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/promotions")
  return { success: true }
}

export async function adminUpdateBusyPeriodRule(id: string, input: BusyPeriodRuleInput): Promise<{ success?: boolean; error?: string }> {
  if (!(await requireAdmin())) return { error: "Not authorized" }
  if (!input.label.trim()) return { error: "Label is required" }
  if (!input.multiplier || input.multiplier < 1) return { error: "Multiplier must be at least 1.0" }

  const admin = createAdminClient()
  const { error } = await admin.from("busy_period_rules").update({ ...input, label: input.label.trim() }).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/promotions")
  return { success: true }
}

export async function adminDeleteBusyPeriodRule(id: string): Promise<{ success?: boolean; error?: string }> {
  if (!(await requireAdmin())) return { error: "Not authorized" }
  const admin = createAdminClient()
  const { error } = await admin.from("busy_period_rules").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/promotions")
  return { success: true }
}
