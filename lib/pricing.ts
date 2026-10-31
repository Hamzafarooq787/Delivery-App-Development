/**
 * lib/pricing.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure pricing functions — base price tiers, busy-period rule matching, and
 * surge factor combination. No I/O here; app/actions/pricing.ts wires these
 * together with live data (Google Directions, driver counts, DB config).
 */

export function getBasePrice(miles: number): number {
  if (miles <= 3) return 10
  if (miles <= 7) return 15
  if (miles <= 12) return 20
  return Math.round((20 + (miles - 12) * 1.5) * 100) / 100
}

// £10 stays "£10", £21.5 becomes "£21.50"
export function formatPrice(price: number): string {
  return Number.isInteger(price) ? String(price) : price.toFixed(2)
}

export type BusyPeriodRule = {
  label: string
  day_of_week: number | null // 0=Sunday..6=Saturday, null = every day
  start_time: string // "HH:MM:SS" or "HH:MM"
  end_time: string
  multiplier: number
  active: boolean
}

/** Returns every currently-active busy-period rule that matches `now`. */
export function matchingBusyPeriodRules(rules: BusyPeriodRule[], now: Date): BusyPeriodRule[] {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now)
  const part = (key:string) => parts.find(p=>p.type===key)?.value??""
  const day = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(part("weekday"))
  const minutesNow = Number(part("hour"))*60+Number(part("minute"))

  function toMinutes(t: string): number {
    const [h, m] = t.split(":").map(Number)
    return h * 60 + (m || 0)
  }

  return rules.filter((r) => {
    if (!r.active) return false
    const start = toMinutes(r.start_time)
    const end = toMinutes(r.end_time)
    const startDay = start > end && minutesNow < end ? (day+6)%7 : day
    if(r.day_of_week!==null && r.day_of_week!==startDay)return false
    return start <= end ? minutesNow >= start && minutesNow < end : minutesNow >= start || minutesNow < end
  })
}

export type SurgeFactor = { label: string; multiplier: number }

/**
 * Combines surge factors via MAX (not multiplicative/additive) so multiple
 * simultaneous factors (e.g. busy period + high demand) don't compound into
 * runaway pricing — the single strongest applicable factor wins, capped at
 * maxTotalMultiplier. Always returns >= 1.0.
 */
export function combineSurgeFactors(
  factors: SurgeFactor[],
  maxTotalMultiplier: number
): { multiplier: number; factors: SurgeFactor[] } {
  if (!Number.isFinite(maxTotalMultiplier) || maxTotalMultiplier < 1 || maxTotalMultiplier > 10) throw new Error("Invalid surge cap")
  if (factors.some(f => !Number.isFinite(f.multiplier) || f.multiplier < 1 || f.multiplier > 10)) throw new Error("Invalid surge multiplier")
  const applicable = factors.filter((f) => f.multiplier > 1)
  if (applicable.length === 0) return { multiplier: 1, factors: [] }
  const multiplier = Math.min(maxTotalMultiplier, Math.max(...applicable.map((f) => f.multiplier)))
  return { multiplier: Math.round(multiplier * 100) / 100, factors: applicable }
}
