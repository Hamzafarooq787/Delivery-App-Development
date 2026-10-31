/** Browser-only GPS helpers. Never substitute an IP-derived location for device GPS. */
export type LocationIssue = { message: string; help?: string }

export function locationIssue(error: unknown, userAgent = navigator.userAgent): LocationIssue {
  const code = (error as { code?: number })?.code
  if (code === 1) {
    const help = /iPhone|iPad|iPod/i.test(userAgent)
      ? 'In iPhone Settings → Privacy & Security → Location Services, allow your browser to use location while using the app. Also allow Location in this website’s browser settings, then tap Try again.'
      : /Android/i.test(userAgent)
        ? 'Turn on your phone’s Location setting. Allow location for your browser in app permissions and for this website in Site settings → Location, then tap Try again.'
        : 'Allow Location for this website using the icon beside the address bar. Also enable location for your browser in your device settings, then tap Try again.'
    return { message: 'Location access is blocked. You can enable it or enter an address.', help }
  }
  if (code === 2) return { message: 'Your device could not find a location. Turn on Location Services, check your signal and try again, or enter an address.' }
  if (code === 3) return { message: 'Finding your location took too long. Try again with a better signal, or enter an address.' }
  return { message: error instanceof Error ? error.message : 'Location is unavailable. Try again or enter an address.' }
}

let pendingLocation: Promise<GeolocationPosition> | null = null

export function requestBrowserLocation(): Promise<GeolocationPosition> {
  // The automatic step request and either address button share an in-flight
  // request, so one browser permission dialog serves all waiting callers.
  if (pendingLocation) return pendingLocation
  if (!window.isSecureContext) return Promise.reject(new Error('Open GoDrop using HTTPS to use your location.'))
  if (!navigator.geolocation) return Promise.reject(new Error('This browser does not support location. Please enter an address.'))
  // Call the native API synchronously from Continue or Use my location. An
  // asynchronous permission pre-check can lose the browser's user activation.
  const request = new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, error => {
      // A slow indoor GPS fix is not a permission denial. Retry once with the
      // network-assisted setting; never retry a denied permission automatically.
      if (error.code !== 2 && error.code !== 3) { reject(error); return }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false, timeout: 10000, maximumAge: 30000,
      })
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
  })
  pendingLocation = request
  void request.then(() => { pendingLocation = null }, () => { pendingLocation = null })
  return request
}
