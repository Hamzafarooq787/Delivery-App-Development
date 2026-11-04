export const PRECISE_DELIVERY_ADDRESS_ERROR = "Choose a building or street number with a full UK postcode for delivery."

/** Reject area, town, street-only and postcode-district results. */
export function isPreciseDeliveryAddress(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 400) return false
  const postcode = /\b(?:GIR\s*0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i
  const found = value.match(postcode)
  if (!found) return false
  const line = value.slice(0, found.index).split(",")[0].trim()
  if (line.length < 5) return false
  return /\b\d+[a-z]?\b/i.test(line) && /[a-z]{2}/i.test(line)
    || /\b(?:house|cottage|palace|farm|hall|building|centre|hotel|court|lodge|apartments|hospital|school|library|station)\b/i.test(line)
}
