// Accept standard UK national numbers and normalise them to +44.
export function normaliseUKPhone(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40 || !/^[+\d ()-]+$/.test(value.trim())) return null
  const compact = value.replace(/[ ()-]/g,"")
  const national = compact.startsWith("+44") ? compact.slice(3) : compact.startsWith("0044") ? compact.slice(4) : compact.startsWith("0") ? compact.slice(1) : /^7\d{9}$/.test(compact) ? compact : ""
  return /^[1235789]\d{9}$/.test(national) ? `+44${national}` : null
}

export const UK_MOBILE_ERROR = "Please enter a UK mobile number"

export function normaliseUKMobile(value: unknown): string | null {
  const phone = normaliseUKPhone(value)
  return phone && /^\+447[1-57-9]\d{8}$/.test(phone) ? phone : null
}
