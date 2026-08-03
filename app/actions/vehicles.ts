/**
 * app/actions/vehicles.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server actions for driver vehicle management. A driver can register
 * multiple vehicles (see scripts/022_driver_vehicles.sql); job matching in
 * app/actions/delivery.ts and app/actions/notifications.ts uses the union of
 * capabilities across ALL of a driver's vehicles.
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { VEHICLE_TYPES, isVehicleType, isMotorVehicle, type VehicleType } from "@/lib/vehicles"

export type DriverVehicle = {
  id: string
  vehicle_type: VehicleType
  make: string | null
  model: string | null
  colour: string | null
  registration_number: string | null
  driving_licence_details: string | null
  insurance_details: string | null
  created_at: string
}

export type VehicleInput = {
  vehicle_type: string
  make: string
  model: string
  colour: string
  registration_number: string
  driving_licence_details: string
  insurance_details: string
}

const VEHICLE_COLUMNS =
  "id, vehicle_type, make, model, colour, registration_number, driving_licence_details, insurance_details, created_at"

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getMyVehicles(): Promise<{ data: DriverVehicle[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: "Not authenticated" }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("driver_vehicles")
    .select(VEHICLE_COLUMNS)
    .eq("driver_id", user.id)
    .order("created_at", { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as DriverVehicle[] }
}

export async function adminGetDriverVehicles(driverId: string): Promise<DriverVehicle[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("driver_vehicles")
    .select(VEHICLE_COLUMNS)
    .eq("driver_id", driverId)
    .order("created_at", { ascending: true })
  return (data ?? []) as DriverVehicle[]
}

// ── Validation ───────────────────────────────────────────────────────────────

function validateVehicleInput(input: VehicleInput): { error?: string; vehicleType?: VehicleType } {
  if (!isVehicleType(input.vehicle_type)) {
    return { error: `Select a valid vehicle type (${VEHICLE_TYPES.join(", ")}).` }
  }
  const vehicleType = input.vehicle_type

  if (!input.make.trim() || !input.model.trim()) return { error: "Make and model are required." }
  if (!input.colour.trim()) return { error: "Vehicle colour is required." }

  if (isMotorVehicle(vehicleType)) {
    if (!input.registration_number.trim()) return { error: "Registration number is required for this vehicle type." }
    if (!input.driving_licence_details.trim()) return { error: "Driving licence details are required for this vehicle type." }
    if (!input.insurance_details.trim()) return { error: "Insurance details are required for this vehicle type." }
  }

  return { vehicleType }
}

function toRow(input: VehicleInput, vehicleType: VehicleType) {
  return {
    vehicle_type: vehicleType,
    make: input.make.trim(),
    model: input.model.trim(),
    colour: input.colour.trim(),
    registration_number: input.registration_number.trim() || null,
    driving_licence_details: input.driving_licence_details.trim() || null,
    insurance_details: input.insurance_details.trim() || null,
  }
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function addVehicle(input: VehicleInput): Promise<{ success?: boolean; error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error: validationError, vehicleType } = validateVehicleInput(input)
  if (validationError || !vehicleType) return { error: validationError }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("driver_vehicles")
    .insert({ driver_id: user.id, ...toRow(input, vehicleType) })
    .select("id")
    .single()

  if (error) return { error: error.message }

  revalidatePath("/dashboard/driver/verification")
  revalidatePath("/dashboard/driver/settings")
  return { success: true, id: data.id }
}

export async function updateVehicle(vehicleId: string, input: VehicleInput): Promise<{ success?: boolean; error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error: validationError, vehicleType } = validateVehicleInput(input)
  if (validationError || !vehicleType) return { error: validationError }

  const admin = createAdminClient()
  const { error } = await admin
    .from("driver_vehicles")
    .update({ ...toRow(input, vehicleType), updated_at: new Date().toISOString() })
    .eq("id", vehicleId)
    .eq("driver_id", user.id) // ownership check — never trust vehicleId alone

  if (error) return { error: error.message }

  revalidatePath("/dashboard/driver/verification")
  revalidatePath("/dashboard/driver/settings")
  return { success: true }
}

export async function deleteVehicle(vehicleId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()

  // An approved driver must always have at least one vehicle on file.
  const [countRes, profileRes] = await Promise.all([
    admin.from("driver_vehicles").select("id", { count: "exact", head: true }).eq("driver_id", user.id),
    admin.from("driver_profiles").select("status").eq("id", user.id).maybeSingle(),
  ])

  if ((countRes.count ?? 0) <= 1 && profileRes.data?.status === "approved") {
    return { error: "You must have at least one vehicle registered while approved to drive." }
  }

  const { error } = await admin
    .from("driver_vehicles")
    .delete()
    .eq("id", vehicleId)
    .eq("driver_id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/driver/verification")
  revalidatePath("/dashboard/driver/settings")
  return { success: true }
}
