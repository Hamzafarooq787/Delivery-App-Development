'use client'
import { useEffect, useRef, useState } from 'react'
import { fetchRoute, type LngLat } from '@/lib/google'

/** Refresh moving routes every 20s without starving requests during frequent GPS updates. */
export function useTrackingRoute(from: LngLat | null, to: LngLat | null, moving = false) {
  const [route, setRoute] = useState<GeoJSON.LineString | null>(null)
  const latest = useRef({ from, to })
  useEffect(() => { latest.current = { from, to } }, [from, to])
  const fromLat = moving ? null : from?.lat
  const fromLng = moving ? null : from?.lng
  const available = Boolean(from && to)
  useEffect(() => {
    let active = true
    let inFlight = false
    setRoute(null)
    if (!available) return
    const refresh = async () => {
      if (inFlight) return
      const points = latest.current
      if (!points.from || !points.to) return
      inFlight = true
      try {
        const result = await fetchRoute(points.from, points.to)
        if (active) setRoute(result?.geometry ?? null)
      } catch { if(active)setRoute(null) } finally { inFlight = false }
    }
    void refresh()
    const timer = moving ? setInterval(() => { void refresh() }, 20000) : null
    return () => { active = false; if (timer) clearInterval(timer) }
  }, [fromLat, fromLng, to?.lat, to?.lng, available, moving])
  return route
}
