import { createClient } from "@/lib/supabase/server"
import Image from "next/image"
import Link from "next/link"

export const dynamic = "force-dynamic"

// ── helpers ───────────────────────────────────────────────────────────────────

function driverTier(completed: number): string {
  if (completed >= 50) return "Legend"
  if (completed >= 20) return "Elite"
  if (completed >= 5)  return "Pro"
  return "Rookie"
}

function reliabilityScore(completed: number, cancelled: number): number {
  const total = completed + cancelled
  if (total === 0) return 0
  return Math.round((completed / total) * 100)
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// Returns 7 bar heights (0–100) for the last 7 days, newest last.
function sparkline(earnings: { amount: number | null; created_at: string }[]): number[] {
  const now = Date.now()
  const days = Array.from({ length: 7 }, (_, i) => {
    const dayStart = startOfDay(new Date(now - (6 - i) * 86_400_000))
    const dayEnd   = dayStart + 86_400_000
    return earnings
      .filter(e => { const t = new Date(e.created_at).getTime(); return t >= dayStart && t < dayEnd })
      .reduce((s, e) => s + (e.amount ?? 0), 0)
  })
  const max = Math.max(...days, 0.01)
  return days.map(v => Math.max(Math.round((v / max) * 100), 4))
}

function todayEarnings(earnings: { amount: number | null; created_at: string }[]): number {
  const start = startOfDay(new Date())
  return earnings
    .filter(e => new Date(e.created_at).getTime() >= start)
    .reduce((s, e) => s + (e.amount ?? 0), 0)
}

// ── component ─────────────────────────────────────────────────────────────────

export default async function DriverDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [jobsRes, earningsRes, fallbackEarningsRes, payoutsRes] = await Promise.all([
    supabase
      .from("delivery_requests")
      .select("id, tracking_number, status, pickup_address, delivery_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng, price, created_at")
      .eq("driver_id", user?.id ?? "")
      .order("created_at", { ascending: false }),

    // Primary earnings source
    supabase
      .from("driver_earnings")
      .select("amount, commission_amount, status, created_at, delivery_id")
      .eq("driver_id", user?.id ?? ""),

    // Fallback: completed deliveries with no driver_earnings row yet
    // (same pattern used in driver/earnings and driver/payouts pages)
    supabase
      .from("delivery_requests")
      .select("id, price, created_at")
      .eq("driver_id", user?.id ?? "")
      .eq("status", "delivered")
      .not("price", "is", null),

    // Payout requests — used for the "pending withdrawal" label
    // (derive status from payouts table, not driver_earnings.status, because
    //  synthetic earnings always have status="pending" in JS regardless of
    //  whether the driver has already requested a payout)
    supabase
      .from("payouts")
      .select("amount, status")
      .eq("driver_id", user?.id ?? ""),
  ])

  const jobs         = jobsRes.data  ?? []
  const realEarnings = earningsRes.data ?? []
  const driverPayouts = payoutsRes.data ?? []

  // Track delivery IDs already covered by a driver_earnings row
  const coveredIds = new Set(
    realEarnings.map(e => (e as any).delivery_id).filter(Boolean),
  )

  // Synthesise earnings for deliveries that have no driver_earnings record
  const syntheticEarnings = (fallbackEarningsRes.data ?? [])
    .filter(d => !coveredIds.has(d.id))
    .map(d => ({
      amount:            d.price != null ? Math.round(d.price * 0.75 * 100) / 100 : null,
      commission_amount: d.price != null ? Math.round(d.price * 0.25 * 100) / 100 : null,
      status:            "pending" as const,
      created_at:        d.created_at,
      delivery_id:       d.id,
    }))

  // Merged earnings — real rows take precedence; synthetic fill the gaps
  const earnings = [...realEarnings, ...syntheticEarnings]

  // ── aggregates ──
  const ACTIVE_STATUSES = ["accepted", "collected", "picked_up", "in_transit"]
  const activeJobs    = jobs.filter(j => ACTIVE_STATUSES.includes(j.status))
  const completedJobs = jobs.filter(j => j.status === "delivered")
  const cancelledJobs = jobs.filter(j => j.status === "cancelled")

  const totalEarnings = earnings.reduce((s, e) => s + (e.amount ?? 0), 0)
  const todayTotal    = todayEarnings(earnings)
  const bars          = sparkline(earnings)

  // "Pending withdrawal" label — derive from payouts table, NOT driver_earnings.status.
  // Synthetic earnings always carry status="pending" in JS regardless of payout state,
  // so using driver_earnings.status here creates a stale label after admin approves.
  const pendingPayoutAmount  = driverPayouts
    .filter(p => p.status === "pending")
    .reduce((s, p) => s + (p.amount ?? 0), 0)
  const approvedPayoutAmount = driverPayouts
    .filter(p => p.status === "approved")
    .reduce((s, p) => s + (p.amount ?? 0), 0)

  const tier       = driverTier(completedJobs.length)
  const reliability = reliabilityScore(completedJobs.length, cancelledJobs.length)

  // Current active job (most recent)
  const activeJob = activeJobs[0] ?? null
  const mapsUrl   = activeJob?.pickup_lat && activeJob?.delivery_lat
    ? `https://www.google.com/maps/dir/?api=1&origin=${activeJob.pickup_lat},${activeJob.pickup_lng}&destination=${activeJob.delivery_lat},${activeJob.delivery_lng}`
    : null

  const routeLabel = activeJob
    ? `${(activeJob.pickup_address ?? "Pickup").split(",")[0]} → ${(activeJob.delivery_address ?? "Drop-off").split(",")[0]}`
    : "No active job"

  // Recent activity — last 5 jobs (any status), no fake data
  const recentActivity = jobs.slice(0, 5)

  const STATUS_ICON: Record<string, { icon: string; color: string }> = {
    delivered:  { icon: "check_circle",   color: "text-[#6ee7b7]" },
    in_transit: { icon: "directions_car", color: "text-[var(--color-primary)]" },
    collected:  { icon: "inventory_2",    color: "text-[var(--color-primary)]" },
    accepted:   { icon: "local_shipping", color: "text-[var(--color-secondary)]" },
    requested:  { icon: "schedule",       color: "text-[#adaaaa]" },
    cancelled:  { icon: "cancel",         color: "text-[#ff6e84]" },
  }

  return (
    <div className="pt-2 pb-12 px-2">
      {/* Header */}
      <header className="mb-8 md:mb-10">
        <h2 className="text-2xl md:text-3xl font-black font-headline tracking-tighter text-white">
          Dashboard
        </h2>
        <p className="text-[#adaaaa] font-medium mt-1">
          Real-time logistics performance and active ops.
        </p>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">

        {/* ── Earnings Card ── */}
        <div className="md:col-span-4 bg-[rgba(38,38,38,0.6)] backdrop-blur-xl rounded-xl p-5 md:p-8 flex flex-col justify-between border border-[#494847]/15 hover:bg-[#201f1f] transition-all group">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary)]">
                Today's Earnings
              </span>
              <span
                className="material-symbols-outlined text-[var(--color-primary)]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                payments
              </span>
            </div>
            <h3 className="text-4xl md:text-5xl font-black font-headline tracking-tighter text-white mb-2">
              £{todayTotal.toFixed(2)}
            </h3>
            <p className="text-xs text-[#adaaaa]">
              All time: <span className="text-[var(--color-primary)] font-bold">£{totalEarnings.toFixed(2)}</span>
              &nbsp;·&nbsp;your 75% share
            </p>
            {pendingPayoutAmount > 0 && (
              <p className="text-xs text-[var(--color-secondary)] mt-1 font-bold">
                £{pendingPayoutAmount.toFixed(2)} pending withdrawal
              </p>
            )}
            {approvedPayoutAmount > 0 && pendingPayoutAmount === 0 && (
              <p className="text-xs text-[#6ee7b7] mt-1 font-bold">
                £{approvedPayoutAmount.toFixed(2)} payout approved ✓
              </p>
            )}
          </div>
          {/* Real 7-day sparkline */}
          <div className="mt-8 h-12 w-full bg-black/30 rounded flex items-end gap-1 p-2">
            {bars.map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-sm ${i === 6 ? "bg-[var(--color-primary)]" : "bg-[var(--color-primary)]/20"}`}
                style={{
                  height: `${h}%`,
                  boxShadow: i === 6 ? "0px 0px 10px rgba(var(--brand-rgb),0.4)" : undefined,
                }}
              />
            ))}
          </div>
        </div>

        {/* ── Stats Cards ── */}
        <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-1 gap-4 md:gap-6">
          <div className="flex-1 bg-[rgba(38,38,38,0.6)] backdrop-blur-xl rounded-xl p-6 hover:bg-[#201f1f] transition-all border border-[#494847]/15">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-secondary)]/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[var(--color-secondary)] text-lg">local_shipping</span>
              </div>
              <span className="text-xs font-bold text-[#adaaaa]">Completed Jobs</span>
            </div>
            <div className="text-4xl font-black font-headline text-white">
              {String(completedJobs.length).padStart(2, "0")}
            </div>
          </div>
          <div className="flex-1 bg-[rgba(38,38,38,0.6)] backdrop-blur-xl rounded-xl p-6 hover:bg-[#201f1f] transition-all border-l-4 border-[var(--color-secondary)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-secondary)]/20 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[var(--color-secondary)] text-lg animate-pulse"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  radar
                </span>
              </div>
              <span className="text-xs font-bold text-[var(--color-secondary)]">Active Jobs</span>
            </div>
            <div className="text-4xl font-black font-headline text-white">
              {String(activeJobs.length).padStart(2, "0")}
            </div>
          </div>
        </div>

        {/* ── Active Map / Current Route ── */}
        <div className="md:col-span-5 relative rounded-xl overflow-hidden bg-[rgba(38,38,38,0.6)] backdrop-blur-xl border border-[#494847]/15 group min-h-[220px] md:min-h-[300px]">
          <Image
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA4gQyry9h81vqsFnspcq3X1Q1ZwbK-FtYMmFr8Rrz-kmla893fw9bVfdPAYDf7n72uazhdT5U5YSI26qz4WqU3lnTWcIUNeXOZIKvzZQOJYO8GtWEJMsKpfgSoVPCCO8qEBlUKXqubCinxsUnvV1PrigqkLl8nc49EnuGT_URTfeX7zscwERnv_yjv97J2_SpC_mAsmGoAjaCza0uzwJHs159VTU-srl7vTJyXlxGnRNkALdggwdng1fcXRDVVRkK7JXHrq6N5DA"
            alt="Active Job Map Tracking"
            fill
            className="object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
            <div className="min-w-0 mr-4">
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#adaaaa] mb-1">
                {activeJob ? "Current Route" : "No Active Job"}
              </p>
              <p className="text-sm font-bold text-white truncate">{routeLabel}</p>
              {activeJob && (
                <p className="text-[10px] text-[#adaaaa] capitalize mt-0.5">{activeJob.status.replace("_", " ")}</p>
              )}
            </div>
            {activeJob ? (
              mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 bg-[var(--color-primary)] text-[var(--color-on-primary)] px-4 py-2 rounded font-bold text-xs"
                  style={{ boxShadow: "0px 0px 10px rgba(var(--brand-rgb),0.4)" }}
                >
                  Open Maps
                </a>
              ) : (
                <Link
                  href={`/dashboard/driver/jobs/${activeJob.id}`}
                  className="shrink-0 bg-[var(--color-primary)] text-[var(--color-on-primary)] px-4 py-2 rounded font-bold text-xs"
                  style={{ boxShadow: "0px 0px 10px rgba(var(--brand-rgb),0.4)" }}
                >
                  View Job
                </Link>
              )
            ) : (
              <Link
                href="/dashboard/driver/jobs/available"
                className="shrink-0 bg-[var(--color-primary)] text-[var(--color-on-primary)] px-4 py-2 rounded font-bold text-xs"
                style={{ boxShadow: "0px 0px 10px rgba(var(--brand-rgb),0.4)" }}
              >
                Find Jobs
              </Link>
            )}
          </div>
        </div>

        {/* ── Recent Activity ── */}
        <div className="lg:col-span-8 bg-[rgba(38,38,38,0.6)] backdrop-blur-xl rounded-xl p-4 md:p-8 border border-[#494847]/15">
          <div className="flex items-center justify-between mb-4 md:mb-8">
            <h4 className="text-lg font-bold font-headline text-white">Recent Activity</h4>
            <Link href="/dashboard/driver/jobs/completed" className="text-xs font-bold text-[var(--color-primary)] hover:underline">
              View History
            </Link>
          </div>
          <div className="space-y-4">
            {recentActivity.length === 0 ? (
              <div className="py-8 text-center">
                <span className="material-symbols-outlined text-[#494847] text-3xl mb-3 block">local_shipping</span>
                <p className="text-sm font-bold text-white mb-1">No jobs yet</p>
                <p className="text-xs text-[#adaaaa]">
                  Your delivery history will appear here once you accept jobs.
                </p>
                <Link
                  href="/dashboard/driver/jobs/available"
                  className="inline-block mt-4 px-4 py-2 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs font-bold hover:bg-[var(--color-primary)]/20 transition-colors"
                >
                  Browse Available Jobs
                </Link>
              </div>
            ) : (
              recentActivity.map((job) => {
                const cfg = STATUS_ICON[job.status] ?? { icon: "local_shipping", color: "text-[#adaaaa]" }
                const isCompleted = job.status === "delivered"
                const earning = isCompleted && job.price ? `+£${(job.price * 0.75).toFixed(2)}` : null
                const statusLabel = job.status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                return (
                  <Link
                    key={job.id}
                    href={`/dashboard/driver/jobs/${job.id}`}
                    className="flex items-center justify-between p-4 rounded-lg bg-[#1a1919]/50 hover:bg-[#1a1919] transition-all"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[#1a1919] flex items-center justify-center shrink-0">
                        <span className={`material-symbols-outlined ${cfg.color}`}>{cfg.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {job.tracking_number ?? job.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-[#adaaaa] truncate">
                          {job.pickup_address ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      {earning ? (
                        <p className="text-sm font-bold text-[#6ee7b7]">{earning}</p>
                      ) : (
                        <p className="text-sm font-bold text-white capitalize">{statusLabel}</p>
                      )}
                      <p className="text-[10px] text-[#adaaaa]">
                        {new Date(job.created_at).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* ── Driver Performance Card ── */}
        <div className="lg:col-span-4 flex flex-col gap-4 md:gap-6">
          <div
            className="bg-[rgba(38,38,38,0.6)] backdrop-blur-xl rounded-xl p-4 md:p-8 border-t-2 border-[var(--color-primary)]"
            style={{ background: "linear-gradient(to bottom right, rgba(var(--brand-rgb),0.1), transparent)" }}
          >
            <h4 className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-widest mb-6">
              Driver Tier: {tier}
            </h4>
            <div className="flex items-end justify-between mb-2">
              <span className="text-sm font-bold text-white">Reliability Score</span>
              <span className="text-2xl font-black text-white">
                {completedJobs.length === 0 ? "—" : `${reliability}%`}
              </span>
            </div>
            <div className="w-full bg-[#1a1919] h-2 rounded-full mb-8">
              <div
                className="bg-[var(--color-primary)] h-full rounded-full transition-all"
                style={{
                  width: completedJobs.length === 0 ? "0%" : `${reliability}%`,
                  boxShadow: "0px 0px 10px rgba(var(--brand-rgb),0.4)",
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-[#1a1919]/30 rounded">
                <p className="text-[10px] text-[#adaaaa] font-bold uppercase">Completed</p>
                <p className="text-lg font-bold text-white">{completedJobs.length}</p>
              </div>
              <div className="p-3 bg-[#1a1919]/30 rounded">
                <p className="text-[10px] text-[#adaaaa] font-bold uppercase">Cancelled</p>
                <p className="text-lg font-bold text-white">{cancelledJobs.length}</p>
              </div>
            </div>
          </div>

          {/* CTA Promo */}
          <div className="relative rounded-xl overflow-hidden min-h-[140px] flex items-center p-5 md:p-8">
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDiGXMQQi74HOHj5uNpLYnRBdZYewqb-vyfLCHqcg9CPKGvF1PolF1Rkc_s6b8pylGknkPc8QNLt0DMzKe6CT3ULjlyAgwGCTz4C7RqK3gyS-ZAeKUKLrVgykWXvNazBEEqZZbUphl-ssiw39GArB2Moc8RU5JYb6ES8AX-bWLQ_bXkx9WKZpHNr32FnYGH9H0PpgFcMbWQ089I2GjcIeJrV14haGJHDWIDQxC8D7s7sYSmb69eVHbCW_dFwL529P45EvHbqmNwTw"
              alt="Fleet Upgrade"
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-[var(--color-secondary)]/80 mix-blend-multiply" />
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-tighter text-white mb-1">
                {tier === "Legend" ? "Top Driver" : "Keep Growing"}
              </p>
              <h5 className="text-xl font-black text-white leading-tight mb-4">
                {tier === "Rookie"  && "Complete 5 jobs to reach Pro tier."}
                {tier === "Pro"     && "Complete 20 jobs to reach Elite tier."}
                {tier === "Elite"   && "Complete 50 jobs to reach Legend tier."}
                {tier === "Legend"  && "You've reached the highest tier!"}
              </h5>
              <Link
                href="/dashboard/driver/jobs/available"
                className="inline-block bg-white text-[var(--color-secondary-dim)] px-6 py-2 rounded-full font-bold text-xs transition-transform active:scale-95"
              >
                {tier === "Legend" ? "Find More Jobs" : "Level Up"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

