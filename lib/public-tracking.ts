export function normaliseTrackingNumber(value: unknown) {
  if (typeof value !== "string") return null
  const number = value.trim().toUpperCase()
  return /^[A-Z0-9][A-Z0-9-]{2,79}$/.test(number) ? number : null
}
export const trackingLabels: Record<string,string> = {
  requested: "Waiting for a driver", accepted: "Driver assigned",
  collected: "Collected", picked_up: "Collected",
  in_transit: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled",
}
