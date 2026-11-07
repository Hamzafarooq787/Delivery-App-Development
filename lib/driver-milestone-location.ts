import { updateMyLocation } from "@/app/actions/tracking"
import { canRequestDriverLocation } from "@/lib/driver-location-permission"
import { shortRequest } from "@/lib/short-request"
import { isFreshLocation } from "@/lib/tracking-utils"

let lastShared: { jobId: string; measuredAt: number } | null = null

export function validDriverPosition(position: GeolocationPosition, now = Date.now()) {
  const { latitude, longitude } = position.coords
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    Number.isFinite(longitude) && Math.abs(longitude) <= 180 && isFreshLocation(position.timestamp, now)
}

export function driverLocationPayload(position: GeolocationPosition, jobId: string) {
  const c = position.coords
  return {
    lat: c.latitude, lng: c.longitude, heading: c.heading, speed: c.speed, accuracy: c.accuracy,
    delivery_id: jobId, measured_at: new Date(position.timestamp).toISOString(),
  }
}

export function rememberSharedDriverLocation(jobId: string, measuredAt: number) {
  if (lastShared?.jobId !== jobId || measuredAt > lastShared.measuredAt) lastShared = { jobId, measuredAt }
}

export function hasSharedDriverLocation(jobId: string, now = Date.now()) {
  return lastShared?.jobId === jobId && isFreshLocation(lastShared.measuredAt, now)
}

/** Try one bounded, network-assisted fix before letting the driver choose to continue. */
export async function confirmDriverMilestone(jobId: string, message: string) {
  if (hasSharedDriverLocation(jobId)) return window.confirm(message)
  try {
    if (navigator.geolocation && navigator.onLine && await shortRequest(canRequestDriverLocation(true), 1000)) {
      const position = await shortRequest(new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, maximumAge: 10000, timeout: 4000 })
      }), 4500)
      if (validDriverPosition(position)) {
        const result = await shortRequest(updateMyLocation(driverLocationPayload(position, jobId)), 4000)
        if (result.ok) rememberSharedDriverLocation(jobId, position.timestamp)
      }
    }
  } catch { /* A missing fix is not a delivery-status error. */ }
  return window.confirm(hasSharedDriverLocation(jobId) ? message :
    `${message}\n\nLocation is still unavailable after retrying. You can continue without a location. GoDrop will record this for support, and live tracking will resume when a fix is available.`)
}
