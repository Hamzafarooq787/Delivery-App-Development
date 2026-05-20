import { createClient } from "@/lib/supabase/server"
import { RequestPayoutButton } from "@/components/driver/request-payout-button"

function fmt(n: number) {
  return `£${n.toFixed(2)}`
}

export const dynamic = "force-dynamic"

export default async function DriverPayoutsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [earningsRes, payoutsRes] = await Promise.all([
    supabase
      .from("driver_earnings")
      .select("id, amount, commission_amount, status, created_at, delivery_requests(tracking_number, pickup_address, delivery_address, price)")
      .eq("driver_id", user?.id ?? "")
      .order("created_at", { ascending: false }),
    supabase
      .from("payouts")
      .select("id, amount, status, created_at")
      .eq("driver_id", user?.id ?? "")
      .order("created_at", { ascending: false }),
  ])

  const earnings = earningsRes.data ?? []
  const payouts  = payoutsRes.data ?? []

  const totalEarned    = earnings.reduce((s, e) => s + (e.amount ?? 0), 0)
  // totalPaidOut = sum of all processed payout records (more accurate than earnings.status)
  const totalPaidOut   = payouts.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount ?? 0), 0)
  const pendingBalance = earnings.filter(e => e.status === "pending").reduce((s, e) => s + (e.amount ?? 0), 0)

  return (
    <div className="pt-2 pb-12 px-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 md:mb-10">
        <div>
          <h2 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tighter text-white">Payouts</h2>
          <p className="text-[#adaaaa] mt-1">Your earnings breakdown and withdrawal history.</p>
        </div>
        <RequestPayoutButton pendingBalance={pendingBalance} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
        {/* Pending balance — highlighted */}
        <div className="bg-[rgba(38,38,38,0.6)] backdrop-blur-xl p-6 rounded-2xl relative overflow-hidden border border-[#a3a6ff]/20 shadow-lg">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#a3a6ff]/10 rounded-full blur-3xl" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#a3a6ff]">Available Balance</span>
            <span className="material-symbols-outlined text-[#a3a6ff]">account_balance_wallet</span>
          </div>
          <p className="text-3xl md:text-4xl font-black font-headline text-white">{fmt(pendingBalance)}</p>
          <p className="text-xs text-[#adaaaa] mt-1">Ready to withdraw</p>
        </div>

        <div className="bg-[#1a1919] p-6 rounded-2xl border border-[#494847]/5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#adaaaa]">Total Earned</span>
            <span className="material-symbols-outlined text-[#adaaaa]">emoji_events</span>
          </div>
          <p className="text-3xl md:text-4xl font-black font-headline text-white">{fmt(totalEarned)}</p>
          <p className="text-xs text-[#adaaaa] mt-1">{earnings.length} completed jobs</p>
        </div>

        <div className="bg-[#1a1919] p-6 rounded-2xl border border-[#494847]/5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#adaaaa]">Total Paid Out</span>
            <span className="material-symbols-outlined text-[#adaaaa]">payments</span>
          </div>
          <p className="text-3xl md:text-4xl font-black font-headline text-white">{fmt(totalPaidOut)}</p>
          <p className="text-xs text-[#adaaaa] mt-1">
            {payouts.filter(p => p.status === "paid").length} payout{payouts.filter(p => p.status === "paid").length !== 1 ? "s" : ""} processed
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Earnings per delivery */}
        <div className="lg:col-span-7 flex flex-col">
          <h3 className="text-lg font-bold font-headline text-white mb-5">Earnings per Delivery</h3>
          <div className="bg-[#1a1919] rounded-2xl overflow-hidden flex-1">
            {earnings.length === 0 ? (
              <div className="py-16 text-center px-8">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[#262626] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#a3a6ff]">local_shipping</span>
                </div>
                <p className="text-sm font-bold text-white mb-1">No earnings yet</p>
                <p className="text-xs text-[#adaaaa]">Complete deliveries to see your earnings here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[460px]">
                  <div className="grid grid-cols-12 px-6 py-4 border-b border-[#494847]/10 text-[10px] uppercase tracking-widest font-bold text-[#adaaaa]">
                    <div className="col-span-5">Delivery</div>
                    <div className="col-span-3 text-right">Fare</div>
                    <div className="col-span-2 text-right">Your Cut</div>
                    <div className="col-span-2 text-right">Status</div>
                  </div>
                  <div className="divide-y divide-[#494847]/5">
                    {earnings.map((e) => {
                      const dr = e.delivery_requests as any
                      const fare = dr?.price ?? (e.amount ?? 0) / 0.75
                      const isPaid = e.status === "paid"
                      return (
                        <div key={e.id} className="grid grid-cols-12 px-6 py-4 items-center hover:bg-[#201f1f] transition-colors">
                          <div className="col-span-5 min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                              {dr?.tracking_number ?? "Delivery"}
                            </p>
                            <p className="text-xs text-[#adaaaa]">
                              {new Date(e.created_at).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                            </p>
                          </div>
                          <div className="col-span-3 text-right">
                            <p className="text-xs text-[#adaaaa]">{fmt(fare)}</p>
                          </div>
                          <div className="col-span-2 text-right">
                            <p className="text-sm font-black text-white">{fmt(e.amount ?? 0)}</p>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                              isPaid
                                ? "bg-[#6ee7b7]/10 text-[#6ee7b7]"
                                : "bg-[#c180ff]/10 text-[#c180ff]"
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${isPaid ? "bg-[#6ee7b7]" : "bg-[#c180ff] animate-pulse"}`} />
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
          <div className="bg-[#1a1919] rounded-2xl overflow-hidden flex-1">
            {payouts.length === 0 ? (
              <div className="py-16 text-center px-8">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[#262626] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#adaaaa]">history</span>
                </div>
                <p className="text-sm font-bold text-white mb-1">No payouts yet</p>
                <p className="text-xs text-[#adaaaa]">Request your first payout once you have earnings.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#494847]/5">
                {payouts.map((p) => {
                  const isPaid = p.status === "paid"
                  return (
                    <div key={p.id} className="flex items-center justify-between px-6 py-4 hover:bg-[#201f1f] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isPaid ? "bg-[#6ee7b7]/10" : "bg-[#c180ff]/10"}`}>
                          <span className={`material-symbols-outlined text-lg ${isPaid ? "text-[#6ee7b7]" : "text-[#c180ff]"}`}>
                            {isPaid ? "check_circle" : "schedule"}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">#{p.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-xs text-[#adaaaa]">
                            {new Date(p.created_at).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-white">{fmt(p.amount ?? 0)}</p>
                        <span className={`text-[10px] font-bold ${isPaid ? "text-[#6ee7b7]" : "text-[#c180ff]"}`}>
                          {isPaid ? "Disbursed" : "Processing"}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Commission info */}
          <div className="mt-4 bg-[#1a1919] rounded-2xl p-5 border border-[#494847]/10">
            <p className="text-[10px] font-bold text-[#adaaaa] uppercase tracking-widest mb-3">Commission Structure</p>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-white font-bold">Your share</span>
                <span className="text-[#6ee7b7] font-black">75%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#adaaaa]">Platform fee</span>
                <span className="text-[#c180ff] font-bold">25%</span>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-[#262626] overflow-hidden flex">
              <div className="h-full bg-[#6ee7b7] rounded-l-full" style={{ width: "75%" }} />
              <div className="h-full bg-[#c180ff] rounded-r-full" style={{ width: "25%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
