import { createClient } from "@/lib/supabase/server"
import { RequestPayoutButton } from "@/components/driver/request-payout-button"
import { SubTabs } from "@/components/ui/sub-tabs"

function fmt(n: number) {
  return `£${n.toFixed(2)}`
}

export const dynamic = "force-dynamic"

export default async function DriverPayoutsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [earningsRes, fallbackRes, payoutsRes] = await Promise.all([
    // Primary: driver_earnings rows for this driver
    supabase
      .from("driver_earnings")
      .select("id, amount, commission_amount, status, created_at, delivery_requests(id, tracking_number, price)")
      .eq("driver_id", user?.id ?? "")
      .order("created_at", { ascending: false }),

    // Fallback: completed deliveries with no driver_earnings row yet
    // (jobs done before the auto-earnings feature was introduced)
    supabase
      .from("delivery_requests")
      .select("id, tracking_number, price, created_at")
      .eq("driver_id", user?.id ?? "")
      .eq("status", "delivered")
      .not("price", "is", null)
      .order("created_at", { ascending: false }),

    // Driver payout history
    supabase
      .from("payouts")
      .select("id, amount, status, created_at")
      .eq("driver_id", user?.id ?? "")
      .order("created_at", { ascending: false }),
  ])

  const realEarnings = earningsRes.data ?? []
  const payouts      = payoutsRes.data  ?? []

  // Collect delivery IDs already covered by a driver_earnings row
  const coveredDeliveryIds = new Set(
    realEarnings
      .map((e: any) => {
        const dr = e.delivery_requests
        return Array.isArray(dr) ? (dr[0]?.id ?? null) : (dr?.id ?? null)
      })
      .filter(Boolean),
  )

  // Synthesise earnings rows for deliveries that have no driver_earnings record
  const syntheticEarnings = (fallbackRes.data ?? [])
    .filter(d => !coveredDeliveryIds.has(d.id))
    .map(d => ({
      id:                `synthetic-${d.id}`,
      amount:            d.price != null ? Math.round(d.price * 0.75 * 100) / 100 : null,
      commission_amount: d.price != null ? Math.round(d.price * 0.25 * 100) / 100 : null,
      // For payouts page, synthetic = pending (driver hasn't been paid out yet)
      status:            "pending" as const,
      created_at:        d.created_at,
      delivery_requests: { id: d.id, tracking_number: d.tracking_number, price: d.price },
    }))

  // Merge: real rows first (most recent), then synthetic for any gaps
  const allEarnings = [...realEarnings, ...syntheticEarnings]

  // ── Summary numbers ────────────────────────────────────────────────────────
  const totalEarned = allEarnings.reduce((s, e) => s + (e.amount ?? 0), 0)

  // Deduct ALL committed payouts from available balance:
  //   pending  = awaiting admin review
  //   approved = admin approved, payment in progress
  //   paid     = disbursed
  // Only rejected payouts are excluded (the amount returns to available).
  const committedAmount = payouts
    .filter(p => ["pending", "approved", "paid"].includes(p.status))
    .reduce((s, p) => s + (p.amount ?? 0), 0)

  // "Available balance" — what the driver can still request
  const pendingBalance = Math.max(0, Math.round((totalEarned - committedAmount) * 100) / 100)

  // "Total Paid Out" card — only fully disbursed payouts
  const totalPaidOut = payouts.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount ?? 0), 0)

  return (
    <div className="pt-2 pb-12 px-2">
      <SubTabs
        className="mb-6"
        tabs={[
          { label: "Earnings", href: "/dashboard/driver/earnings", icon: "payments" },
          { label: "Payouts",  href: "/dashboard/driver/payouts",  icon: "account_balance_wallet" },
        ]}
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 md:mb-10">
        <div>
          <h2 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tighter text-white">Payouts</h2>
          <p className="text-[var(--color-on-surface-variant)] mt-1">Your earnings breakdown and withdrawal history.</p>
        </div>
        <RequestPayoutButton pendingBalance={pendingBalance} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
        {/* Pending balance — highlighted */}
        <div className="bg-[var(--brand-panel)] backdrop-blur-xl p-6 rounded-2xl relative overflow-hidden border border-[var(--brand-strong)]/20 shadow-lg">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[var(--brand-strong)]/10 rounded-full blur-3xl" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--brand-soft)]">Available Balance</span>
            <span className="material-symbols-outlined text-[var(--brand-soft)]">account_balance_wallet</span>
          </div>
          <p className="text-3xl md:text-4xl font-black font-headline text-white">{fmt(pendingBalance)}</p>
          <p className="text-xs text-[var(--color-on-surface-variant)] mt-1">Ready to withdraw</p>
        </div>

        <div className="bg-[var(--brand-panel)] p-6 rounded-2xl border border-[var(--color-outline-variant)]/5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">Total Earned</span>
            <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]">emoji_events</span>
          </div>
          <p className="text-3xl md:text-4xl font-black font-headline text-white">{fmt(totalEarned)}</p>
          <p className="text-xs text-[var(--color-on-surface-variant)] mt-1">{allEarnings.length} completed job{allEarnings.length !== 1 ? "s" : ""}</p>
        </div>

        <div className="bg-[var(--brand-panel)] p-6 rounded-2xl border border-[var(--color-outline-variant)]/5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">Total Paid Out</span>
            <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]">payments</span>
          </div>
          <p className="text-3xl md:text-4xl font-black font-headline text-white">{fmt(totalPaidOut)}</p>
          <p className="text-xs text-[var(--color-on-surface-variant)] mt-1">
            {payouts.filter(p => p.status === "paid").length} payout{payouts.filter(p => p.status === "paid").length !== 1 ? "s" : ""} processed
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Earnings per delivery */}
        <div className="lg:col-span-7 flex flex-col">
          <h3 className="text-lg font-bold font-headline text-white mb-5">Earnings per Delivery</h3>
          <div className="bg-[var(--brand-panel)] rounded-2xl overflow-hidden flex-1">
            {allEarnings.length === 0 ? (
              <div className="py-16 text-center px-8">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[var(--color-surface-container-highest)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[var(--brand-soft)]">local_shipping</span>
                </div>
                <p className="text-sm font-bold text-white mb-1">No earnings yet</p>
                <p className="text-xs text-[var(--color-on-surface-variant)]">Complete deliveries to see your earnings here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[460px]">
                  <div className="grid grid-cols-12 px-6 py-4 border-b border-[var(--color-outline-variant)]/10 text-[10px] uppercase tracking-widest font-bold text-[var(--color-on-surface-variant)]">
                    <div className="col-span-5">Delivery</div>
                    <div className="col-span-3 text-right">Fare</div>
                    <div className="col-span-2 text-right">Your Cut</div>
                    <div className="col-span-2 text-right">Status</div>
                  </div>
                  <div className="divide-y divide-[var(--color-outline-variant)]/5">
                    {allEarnings.map((e) => {
                      const dr = e.delivery_requests as any
                      // price may come from the joined delivery_requests row
                      const price = Array.isArray(dr) ? (dr[0]?.price ?? null) : (dr?.price ?? null)
                      const tracking = Array.isArray(dr) ? (dr[0]?.tracking_number ?? null) : (dr?.tracking_number ?? null)
                      // Derive fare: from joined price, or back-calculate from 75% cut
                      const fare = price ?? (e.amount != null ? Math.round(e.amount / 0.75 * 100) / 100 : 0)
                      const isPaid = e.status === "paid"
                      return (
                        <div key={e.id} className="grid grid-cols-12 px-6 py-4 items-center hover:bg-[var(--color-surface-container-high)] transition-colors">
                          <div className="col-span-5 min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                              {tracking ?? `KV-${e.id.slice(0, 8).toUpperCase()}`}
                            </p>
                            <p className="text-xs text-[var(--color-on-surface-variant)]">
                              {new Date(e.created_at).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                            </p>
                          </div>
                          <div className="col-span-3 text-right">
                            <p className="text-xs text-[var(--color-on-surface-variant)]">{fmt(fare)}</p>
                          </div>
                          <div className="col-span-2 text-right">
                            <p className="text-sm font-black text-white">{fmt(e.amount ?? 0)}</p>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                              isPaid
                                ? "bg-[#6ee7b7]/10 text-[#6ee7b7]"
                                : "bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]"
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${isPaid ? "bg-[#6ee7b7]" : "bg-[var(--color-secondary)] animate-pulse"}`} />
                              {isPaid ? "Paid" : "Pending"}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payout history */}
        <div className="lg:col-span-5 flex flex-col">
          <h3 className="text-lg font-bold font-headline text-white mb-5">Payout History</h3>
          <div className="bg-[var(--brand-panel)] rounded-2xl overflow-hidden flex-1">
            {payouts.length === 0 ? (
              <div className="py-16 text-center px-8">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[var(--color-surface-container-highest)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]">history</span>
                </div>
                <p className="text-sm font-bold text-white mb-1">No payouts yet</p>
                <p className="text-xs text-[var(--color-on-surface-variant)]">
                  {pendingBalance > 0
                    ? `You have ${fmt(pendingBalance)} available — click Request Payout above.`
                    : "Request your first payout once you have earnings."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-outline-variant)]/5">
                {payouts.map((p) => {
                  type StatusKey = "paid" | "approved" | "pending" | "rejected"
                  const STATUS_MAP: Record<StatusKey, { icon: string; iconColor: string; iconBg: string; label: string; labelColor: string }> = {
                    paid:     { icon: "check_circle",  iconColor: "text-[#6ee7b7]", iconBg: "bg-[#6ee7b7]/10", label: "Disbursed", labelColor: "text-[#6ee7b7]" },
                    approved: { icon: "task_alt",       iconColor: "text-[#60a5fa]", iconBg: "bg-[#60a5fa]/10", label: "Approved",  labelColor: "text-[#60a5fa]" },
                    pending:  { icon: "schedule",       iconColor: "text-[var(--color-secondary)]", iconBg: "bg-[var(--color-secondary)]/10", label: "Pending",   labelColor: "text-[var(--color-secondary)]" },
                    rejected: { icon: "cancel",         iconColor: "text-[#ff6e84]", iconBg: "bg-[#ff6e84]/10", label: "Rejected",  labelColor: "text-[#ff6e84]" },
                  }
                  const statusCfg = STATUS_MAP[p.status as StatusKey] ?? STATUS_MAP.pending

                  return (
                    <div key={p.id} className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-surface-container-high)] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${statusCfg.iconBg}`}>
                          <span className={`material-symbols-outlined text-lg ${statusCfg.iconColor}`}>
                            {statusCfg.icon}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">#{p.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-xs text-[var(--color-on-surface-variant)]">
                            {new Date(p.created_at).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-black ${p.status === "rejected" ? "text-[#ff6e84] line-through opacity-60" : "text-white"}`}>
                          {fmt(p.amount ?? 0)}
                        </p>
                        <span className={`text-[10px] font-bold ${statusCfg.labelColor}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Commission info */}
          <div className="mt-4 bg-[var(--brand-panel)] rounded-2xl p-5 border border-[var(--color-outline-variant)]/10">
            <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest mb-3">Commission Structure</p>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-white font-bold">Your share</span>
                <span className="text-[#6ee7b7] font-black">75%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--color-on-surface-variant)]">Platform fee</span>
                <span className="text-[var(--color-secondary)] font-bold">25%</span>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-[var(--color-surface-container-highest)] overflow-hidden flex">
              <div className="h-full bg-[#6ee7b7] rounded-l-full" style={{ width: "75%" }} />
              <div className="h-full bg-[var(--color-secondary)] rounded-r-full" style={{ width: "25%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

