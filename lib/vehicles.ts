/**
 * lib/vehicles.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared vehicle-type / package-size definitions used by both server actions
 * (job matching, validation) and client components (forms, badges). Single
 * source of truth so the two never drift out of sync.
 */

export const VEHICLE_TYPES = ["bicycle", "motorcycle", "car", "van"] as const
export type VehicleType = (typeof VEHICLE_TYPES)[number]

export const PACKAGE_SIZES = ["small", "medium", "large", "bulky"] as const
export type PackageSize = (typeof PACKAGE_SIZES)[number]

export const VEHICLE_INFO: Record<VehicleType, { label: string; emoji: string; icon: string }> = {
  bicycle: { label: "Bicycle", emoji: "🚲", icon: "pedal_bike" },
  motorcycle: { label: "Motorcycle", emoji: "🏍️", icon: "two_wheeler" },
  car: { label: "Car", emoji: "🚗", icon: "directions_car" },
  van: { label: "Van", emoji: "🚐", icon: "airport_shuttle" },
}

// Each vehicle carries its tier and everything smaller — ordered small to bulky.
export const VEHICLE_CAPABILITIES: Record<VehicleType, PackageSize[]> = {
  bicycle: ["small"],
  motorcycle: ["small", "medium"],
  car: ["small", "medium", "large"],
  van: ["small", "medium", "large", "bulky"],
}

export const PACKAGE_SIZE_INFO: Record<PackageSize, { label: string; description: string; minVehicle: string }> = {
  small: { label: "Small", description: "Documents, small parcels, food, lightweight items", minVehicle: "Bicycle or larger" },
  medium: { label: "Medium", description: "Standard boxes, medium parcels, urgent deliveries", minVehicle: "Motorcycle or larger" },
  large: { label: "Large", description: "Most standard deliveries, bigger items", minVehicle: "Car or larger" },
  bulky: { label: "Bulky", description: "Furniture, large parcels, appliances", minVehicle: "Van only" },
}

/** Registration, driving licence, and insurance are only required for motor vehicles. */
export function isMotorVehicle(type: VehicleType): boolean {
  return type !== "bicycle"
}

/** Union of package sizes carriable across a set of vehicle types (no duplicates). */
export function unionCapabilities(vehicleTypes: VehicleType[]): PackageSize[] {
  const set = new Set<PackageSize>()
  for (const t of vehicleTypes) {
    for (const s of VEHICLE_CAPABILITIES[t] ?? []) set.add(s)
  }
  return Array.from(set)
}

export function isVehicleType(v: string): v is VehicleType {
  return (VEHICLE_TYPES as readonly string[]).includes(v)
}

export function isPackageSize(v: string): v is PackageSize {
  return (PACKAGE_SIZES as readonly string[]).includes(v)
}
