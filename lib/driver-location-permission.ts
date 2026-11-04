const storageKey = "godrop-driver-location-prompted"
let prompted = false

export async function canRequestDriverLocation(allowPrompt: boolean): Promise<boolean> {
  let permission: PermissionState | undefined
  try { permission = (await navigator.permissions?.query({name:"geolocation"}))?.state } catch {}
  if (permission === "granted") return true
  if (permission === "denied" || !allowPrompt) return false
  let saved = false
  try { saved = sessionStorage.getItem(storageKey) === "yes" } catch {}
  if (prompted || saved) return false
  prompted = true
  try { sessionStorage.setItem(storageKey, "yes") } catch {}
  return true
}

export function rememberDriverLocationDenial() {
  prompted = true
  try { sessionStorage.setItem(storageKey, "yes") } catch {}
}
