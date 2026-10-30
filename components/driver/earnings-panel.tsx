"use client"

import { useState } from "react"

type EarningRow = {
  id: string
  amount: number | null            // agreed driver amount
  commission_amount: number | null // recorded platform fee or subsidy
  created_at: string
  delivery_requests: {
    pickup_address: string | null
    delivery_address: string | null
    created_at: string
    price: number | null           // full fare charged to customer
  } | null
}

type Tab = "Daily" | "Weekly" | "Monthly"

function startOf(unit: Tab): Date {
  const now = new Date()
  if (unit === "Daily") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
  if (unit === "Weekly") {
    const day = now.getDay() || 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - day + 1)
    monday.setHours(0, 0, 0, 0)
    return monday
  }
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function sumFor(earnings: EarningRow[], tab: Tab) {
  const cutoff = startOf(tab)
  return earnings
    .filter((e) => new Date(e.created_at) >= cutoff)
    .reduce((s, e) => s + (e.amount ?? 0), 0)
}

function fmt(n: number) {
  return `£${n.toFixed(2)}`
}

export function EarningsPanel({ earnings }: { earnings: EarningRow[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("Daily")

  const cutoff = startOf(activeTab)
  const filtered = earnings.filter((e) => new Date(e.created_at) >= cutoff)

  const todayTotal  = sumFor(earnings, "Daily")
  const weekTotal   = sumFor(earnings, "Weekly")
  const monthTotal  = sumFor(earnings, "Monthly")
  const allTimeTotal = earnings.reduce((s, e) => s + (e.amount ?? 0), 0)

  return (
    <div className="pt-2 pb-12 px-2">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 md:mb-10">
        <div>
          <h2 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tighter text-white">Earnings</h2>
          <p className="text-[var(--color-on-surface-variant)] mt-1">The agreed earnings for each completed delivery.</p>
        </div>
        <div className="flex bg-[var(--brand-panel)] p-1 rounded-xl">
          {(["Daily", "Weekly", "Monthly"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === tab ? "bg-[var(--color-surface-container-high)] text-white" : "text-[var(--color-on-surface-variant)] hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Commission split notice */}
      <div className="flex items-center gap-3 bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/20 rounded-xl px-5 py-4 mb-8">
        <span className="material-symbols-outlined text-[var(--brand-soft)]">info</span>
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Earnings follow the amount agreed before acceptance, including any minimum-pay subsidy. Platform commission applies to service fees, never shopping goods. Each row records the actual deduction.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
        <div className="bg-[var(--brand-panel)] backdrop-blur-xl p-6 rounded-2xl relative overflow-hidden group border border-[var(--color-outline-variant)]/10 shadow-lg">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[var(--brand-strong)]/10 rounded-full blur-3xl group-hover:bg-[var(--brand-strong)]/20 transition-all" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--brand-soft)]">Today</span>
            <span className="material-symbols-outlined text-[var(--brand-soft)]">today</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl md:text-4xl font-black font-headline text-white">{fmt(todayTotal)}</span>
          </div>
        </div>

        <div className="bg-[var(--brand-panel)] p-6 rounded-2xl border border-[var(--color-outline-variant)]/5 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">This Week</span>
            <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]">calendar_view_week</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl md:text-4xl font-black font-headline text-white">{fmt(weekTotal)}</span>
          </div>
        </div>

        <div className="bg-[var(--brand-panel)] p-6 rounded-2xl border border-[var(--color-outline-variant)]/5 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">This Month</span>
            <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]">calendar_month</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl md:text-4xl font-black font-headline text-white">{fmt(monthTotal)}</span>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold font-headline text-white">
              {activeTab === "Daily" ? "Today's" : activeTab === "Weekly" ? "This Week's" : "This Month's"} Transactions
            </h3>
            <span className="text-[var(--brand-soft)] text-xs font-bold">{filtered.length} jobs</span>
          </div>
          <div className="bg-[var(--brand-panel)] rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-[var(--color-outline-variant)]/10 text-[10px] uppercase tracking-widest font-bold text-[var(--color-on-surface-variant)]">
                  <div className="col-span-5">Job Details</div>
                  <div className="col-span-3 text-right">Fare</div>
                  <div className="col-span-2 text-right">Comm.</div>
                  <div className="col-span-2 text-right">Your Cut</div>
                </div>
                <div className="divide-y divide-[var(--color-outline-variant)]/5">
                  {filtered.length === 0 ? (
                    <div className="py-16 text-center text-[var(--color-on-surface-variant)] text-sm">No earnings for this period.</div>
                  ) : (
                    filtered.map((e) => {
                      const fare = e.delivery_requests?.price ?? (e.amount ?? 0) + (e.commission_amount ?? 0)
                      const commission = e.commission_amount ?? fare-(e.amount??0)
                      const driverCut = e.amount ?? 0
                      return (
                        <div key={e.id} className="grid grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-[var(--color-surface-container-high)] transition-colors">
                          <div className="col-span-5 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-container-highest)] flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[var(--brand-soft)] text-lg">local_shipping</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">
                                {e.delivery_requests?.pickup_address ?? "Delivery"}
                              </p>
                              <p className="text-xs text-[var(--color-on-surface-variant)]">
                                {new Date(e.created_at).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                              </p>
                            </div>
                          </div>
                          {/* Fare */}
                          <div className="col-span-3 text-right">
                            <p className="text-sm font-semibold text-[var(--color-on-surface-variant)]">{fmt(fare)}</p>
                          </div>
                          {/* Recorded commission */}
                          <div className="col-span-2 text-right">
                            <p className="text-xs font-semibold text-[var(--color-secondary)]">{commission<0?"Subsidy ":"−"}{fmt(Math.abs(commission))}</p>
                          </div>
                          {/* Agreed driver earnings */}
                          <div className="col-span-2 text-right">
                            <p className="text-sm font-black text-white">{fmt(driverCut)}</p>
                            <p className="text-[10px] text-[#6ee7b7] font-bold">Agreed earnings</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Insights */}
        <div className="lg:col-span-4 space-y-6">
          <h3 className="text-lg font-bold font-headline text-white">Insights</h3>

          {/* Earnings Velocity chart */}
          <div className="bg-[var(--brand-panel)] p-6 rounded-2xl border border-[var(--color-outline-variant)]/5">
            <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--color-on-surface-variant)] mb-4">Earnings Velocity</p>
            <div className="h-32 flex items-end justify-between gap-1 mb-4">
              {[...Array(7)].map((_, i) => {
                const d = new Date()
                d.setDate(d.getDate() - (6 - i))
                d.setHours(0, 0, 0, 0)
                const next = new Date(d)
                next.setDate(d.getDate() + 1)
                const dayTotal = earnings
                  .filter((e) => { const t = new Date(e.created_at); return t >= d && t < next })
                  .reduce((s, e) => s + (e.amount ?? 0), 0)
                const maxDay = Math.max(...[...Array(7)].map((_, j) => {
                  const dd = new Date()
                  dd.setDate(dd.getDate() - (6 - j))
                  dd.setHours(0, 0, 0, 0)
                  const nn = new Date(dd)
                  nn.setDate(dd.getDate() + 1)
                  return earnings.filter(e => { const t = new Date(e.created_at); return t >= dd && t < nn }).reduce((s, e) => s + (e.amount ?? 0), 0)
                }), 1)
                const pct = Math.round((dayTotal / maxDay) * 100)
                return (
                  <div
                    key={i}
                    className={`w-full rounded-t ${i === 6 ? "bg-[var(--brand-strong)]" : "bg-[var(--brand-strong)]/20"}`}
                    style={{ height: `${Math.max(pct, 4)}%`, boxShadow: i === 6 ? "0px 0px 10px rgba(var(--brand-rgb),0.4)" : undefined }}
                  />
                )
              })}
            </div>
            <p className="text-xs text-[var(--color-on-surface-variant)] text-center">Last 7 days of earnings activity.</p>
          </div>

          {/* All-time card */}
          <div className="bg-[var(--brand-panel)] backdrop-blur-xl p-6 rounded-2xl border border-[var(--brand-strong)]/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[var(--brand-strong)] flex items-center justify-center text-[var(--brand-ink)]"
                style={{ boxShadow: "0px 0px 15px rgba(var(--brand-rgb),0.3)" }}>
                <span className="material-symbols-outlined">account_balance_wallet</span>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Total Earned</p>
                <p className="text-[10px] text-[var(--color-on-surface-variant)] font-medium">All time · after commission</p>
              </div>
            </div>
            <p className="text-3xl font-black font-headline text-white mb-2">{fmt(allTimeTotal)}</p>
            <p className="text-xs text-[var(--color-on-surface-variant)]">{earnings.length} completed jobs</p>

            {/* Split breakdown */}
            {earnings.length > 0 && (
              <div className="mt-5 pt-5 border-t border-[var(--color-outline-variant)]/20 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-on-surface-variant)]">Total fares collected</span>
                  <span className="text-white font-bold">
                    {fmt(earnings.reduce((s, e) => {
                      const fare = e.delivery_requests?.price ?? (e.amount ?? 0) + (e.commission_amount ?? 0)
                      return s + fare
                    }, 0))}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-secondary)]">Platform commission</span>
                  <span className="text-[var(--color-secondary)] font-bold">
                    -{fmt(earnings.reduce((s, e) => s + (e.commission_amount ?? 0), 0))}
                  </span>
                </div>
                <div className="flex justify-between text-xs border-t border-[var(--color-outline-variant)]/20 pt-2 mt-1">
                  <span className="text-[#6ee7b7] font-bold">Your earnings</span>
                  <span className="text-[#6ee7b7] font-black">{fmt(allTimeTotal)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

