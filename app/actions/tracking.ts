"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export type DriverLocation = {
  driver_id: string
  delivery_id: string | null
  lat: number
  lng: number
  heading: number | null
  speed: number | null
  accuracy: number | null
  updated_at: string
}

export async function updateMyLocation(input: {
  lat: number
  lng: number
  heading?: number | null
  speed?: number | null
  accuracy?: number | null
  delivery_id?: string | null
  measured_at?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng) || Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180) return { error: "Invalid coordinates" }
  const { data: profile } = await admin.from("driver_profiles").select("status").eq("id", user.id).maybeSingle()
  if (profile?.status !== "approved") return { error: "Approved driver required" }
  if (!input.delivery_id) return { error: "Active job required" }
  const { data: job } = await admin.from("delivery_requests").select("id").eq("id", input.delivery_id).eq("driver_id", user.id).in("status", ["accepted", "collected", "picked_up", "in_transit"]).maybeSingle()
  if (!job) return { error: "Active assigned job required" }
  const measured = input.measured_at ? Date.parse(input.measured_at) : Date.now()
  if (!Number.isFinite(measured) || measured > Date.now() + 5000 || Date.now() - measured > 45000) return { error: "Waiting for a fresh GPS position" }
  const { error } = await admin.from("driver_locations").upsert(
    {
      driver_id: user.id,
      delivery_id: input.delivery_id ?? null,
      lat: input.lat,
      lng: input.lng,
      heading: input.heading ?? null,
      speed: input.speed ?? null,
      accuracy: input.accuracy ?? null,
      updated_at: new Date(measured).toISOString(),
    },
    { onConflict: "driver_id" }
  )

  if (error) return { error: error.message }
  return { ok: true }
}

export async function getDriverLocationForDelivery(deliveryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Not authenticated" }

  const admin = createAdminClient()
  const { data: delivery, error: dErr } = await admin
    .from("delivery_requests")
    .select("driver_id, customer_id, status, pickup_lat, pickup_lng, delivery_lat, delivery_lng")
    .eq("id", deliveryId)
    .maybeSingle()

  if (dErr || !delivery) return { data: null, error: dErr?.message ?? "Delivery not found" }
  if (delivery.customer_id !== user.id && delivery.driver_id !== user.id) {
    const { data: me } = await admin.from("users").select("role").eq("id", user.id).maybeSingle()
    if (me?.role !== "admin") return { data: null, error: "Forbidden" }
  }

  if (!delivery.driver_id || !["accepted", "collected", "picked_up", "in_transit"].includes(delivery.status)) {
    return { data: { delivery, location: null }, error: null }
  }

  const { data: location } = await admin
    .from("driver_locations")
    .select("*")
    .eq("driver_id", delivery.driver_id)
    .eq("delivery_id", deliveryId)
    .maybeSingle()

  return { data: { delivery, location: location as DriverLocation | null }, error: null }
}

export async function clearMyLocation(deliveryId?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  let query=admin.from("driver_locations").delete().eq("driver_id",user.id)
  if(deliveryId)query=query.eq("delivery_id",deliveryId)
  const {error}=await query
  if (error) return { error: error.message }
  return { ok: true }
}

export async function updateCustomerLocation(input: {
  lat: number
  lng: number
  delivery_id?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  const { error } = await admin.from("customer_locations").upsert(
    {
      customer_id: user.id,
      lat: input.lat,
      lng: input.lng,
      delivery_id: input.delivery_id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "customer_id" }
  )
  if (error) return { error: error.message }
  return { ok: true }
}

export async function clearCustomerLocation() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  const { error } = await admin.from("customer_locations").delete().eq("customer_id", user.id)
  if (error) return { error: error.message }
  return { ok: true }
}
