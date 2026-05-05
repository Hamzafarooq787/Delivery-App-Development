"use client"

import { useState } from "react"

type EarningRow = {
  id: string
  amount: number | null
  created_at: string
  delivery_requests: {
    pickup_address: string | null
    delivery_address: string | null
    created_at: string
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

export function EarningsPanel({ earnings }: { earnings: EarningRow[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("Daily")

  const cutoff = startOf(activeTab)
  const filtered = earnings.filter((e) => new Date(e.created_at) >= cutoff)
  const total = filtered.reduce((s, e) => s + (e.amount ?? 0), 0)

  const todayTotal = sumFor(earnings, "Daily")
  const weekTotal = sumFor(earnings, "Weekly")
  const monthTotal = sumFor(earnings, "Monthly")

  return (
    <div className="pt-2 pb-12 px-2">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 md:mb-10">
        <div>
          <h2 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tighter text-white">Earnings</h2>
          <p className="text-[#adaaaa] mt-1">Real-time financial performance and payouts.</p>
        </div>
        <div className="flex bg-[#1a1919] p-1 rounded-xl">
          {(["Daily", "Weekly", "Monthly"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === tab ? "bg-[#201f1f] text-white" : "text-[#adaaaa] hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
        <div className="bg-[rgba(38,38,38,0.6)] backdrop-blur-xl p-6 rounded-2xl relative overflow-hidden group border border-[#494847]/10 shadow-lg">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#a3a6ff]/10 rounded-full blur-3xl group-hover:bg-[#a3a6ff]/20 transition-all" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#a3a6ff]">Today</span>
            <span className="material-symbols-outlined text-[#a3a6ff]">today</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl md:text-4xl font-black font-headline text-white">${todayTotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-[#1a1919] p-6 rounded-2xl border border-[#494847]/5 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#adaaaa]">This Week</span>
            <span className="material-symbols-outlined text-[#adaaaa]">calendar_view_week</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl md:text-4xl font-black font-headline text-white">${weekTotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-[#1a1919] p-6 rounded-2xl border border-[#494847]/5 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#adaaaa]">This Month</span>
            <span className="material-symbols-outlined text-[#adaaaa]">calendar_month</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl md:text-4xl font-black font-headline text-white">${monthTotal.toFixed(2)}</span>
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
            <span className="text-[#a3a6ff] text-xs font-bold">{filtered.length} jobs</span>
          </div>
          <div className="bg-[#1a1919] rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <div className="min-w-[520px]">
                <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-[#494847]/10 text-[10px] uppercase tracking-widest font-bold text-[#adaaaa]">
                  <div className="col-span-6">Job Details</div>
                  <div className="col-span-3">Status</div>
                  <div className="col-span-3 text-right">Amount</div>
                </div>
                <div className="divide-y divide-[#494847]/5">
                  {filtered.length === 0 ? (
                    <div className="py-16 text-center text-[#adaaaa] text-sm">No earnings for this period.</div>
                  ) : (
                    filtered.map((e) => (
                      <div key={e.id} className="grid grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-[#201f1f] transition-colors">
                        <div className="col-span-6 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-[#262626] flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[#a3a6ff]">local_shipping</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                              {e.delivery_requests?.pickup_address ?? "Delivery"}
                            </p>
                            <p className="text-xs text-[#adaaaa]">
                              {new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                          </div>
                        </div>
                        <div className="col-span-3">
                          <span className="px-2 py-1 bg-[#a3a6ff]/10 text-[#a3a6ff] text-[10px] font-bold rounded uppercase">
                            Completed
                          </span>
                        </div>
                        <div className="col-span-3 text-right">
                          <p className="text-sm font-black text-white">${(e.amount ?? 0).toFixed(2)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Insights */}
        <div className="lg:col-span-4 space-y-6">
          <h3 className="text-lg font-bold font-headline text-white">Insights</h3>
          <div className="bg-[#1a1919] p-6 rounded-2xl border border-[#494847]/5">
            <p className="text-[10px] uppercase font-bold tracking-widest text-[#adaaaa] mb-4">Earnings Velocity</p>
            <div className="h-32 flex items-end justify-between gap-1 mb-4">
              {[...Array(7)].map((_, i) => {
                const d = new Date()
                d.setDate(d.getDate() - (6 - i))
                d.setHours(0, 0, 0, 0)
                const next = new Date(d)
                next.setDate(d.getDate() + 1)
                const dayTotal = earnings
                  .filter((e) => {
                    const t = new Date(e.created_at)
                    return t >= d && t < next
                  })
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
                    className={`w-full rounded-t ${i === 6 ? "bg-[#a3a6ff]" : "bg-[#a3a6ff]/20"}`}
                    style={{ height: `${Math.max(pct, 4)}%`, boxShadow: i === 6 ? "0px 0px 10px rgba(163,166,255,0.4)" : undefined }}
                  />
                )
              })}
            </div>
            <p className="text-xs text-[#adaaaa] text-center">Last 7 days of earnings activity.</p>
          </div>

          <div className="bg-[rgba(38,38,38,0.6)] backdrop-blur-xl p-6 rounded-2xl border border-[#a3a6ff]/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#a3a6ff] flex items-center justify-center text-[#0f00a4]" style={{ boxShadow: "0px 0px 15px rgba(163,166,255,0.3)" }}>
                <span className="material-symbols-outlined">account_balance_wallet</span>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Total Earned</p>
                <p className="text-[10px] text-[#adaaaa] font-medium">All time</p>
              </div>
            </div>
            <p className="text-3xl font-black font-headline text-white mb-2">
              ${earnings.reduce((s, e) => s + (e.amount ?? 0), 0).toFixed(2)}
            </p>
            <p className="text-xs text-[#adaaaa]">{earnings.length} completed jobs</p>
          </div>
        </div>
      </div>
    </div>
  )
}
