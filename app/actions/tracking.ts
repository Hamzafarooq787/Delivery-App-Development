"use server"

import { validCoordinates } from "@/lib/customer-validation"
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
  const measured = input.measured_at ? Date.parse(input.measured_at) : Date.now()
  if (!Number.isFinite(measured) || measured > Date.now() + 5000 || Date.now() - measured > 45000) return { error: "Waiting for a fresh GPS position" }
  const { data, error } = await admin.rpc("publish_driver_location", {
    p_driver: user.id, p_job: input.delivery_id,
    p_lat: input.lat, p_lng: input.lng,
    p_heading: input.heading ?? null, p_speed: input.speed ?? null,
    p_accuracy: input.accuracy ?? null, p_measured: new Date(measured).toISOString(),
  })

  if (error) return { error: "Location could not be saved for this active delivery. Please retry." }
  if (!data) return { error: "Waiting for a newer GPS position." }
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

  if (!deliveryId) return { error: "Active delivery required." }
  const admin = createAdminClient()
  const query=admin.from("driver_locations").delete().eq("driver_id",user.id).eq("delivery_id",deliveryId)
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

  if (!validCoordinates(input.lat,input.lng) || !input.delivery_id) return {error:"Choose an active delivery before sharing your location."}
  const admin = createAdminClient()
  const {data:order,error:orderError}=await admin.from('delivery_requests').select('id').eq('id',input.delivery_id).eq('customer_id',user.id).in('status',['accepted','collected','in_transit']).maybeSingle()
  if(orderError||!order)return {error:'Live location sharing is available only for your active delivery with an assigned driver.'}
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

export async function clearCustomerLocation(deliveryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  if (typeof deliveryId !== "string" || !/^[0-9a-f-]{36}$/i.test(deliveryId)) return {error:"Select the delivery whose sharing should stop."}
  const q = admin.from("customer_locations").delete().eq("customer_id", user.id).eq("delivery_id",deliveryId)
  const { error } = await q
  if (error) return { error: error.message }
  return { ok: true }
}
