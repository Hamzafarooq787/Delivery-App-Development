import { createClient } from "@/lib/supabase/server"

export default async function AdminPaymentsPage() {
  const supabase = await createClient()

  const [allPaymentsRes, pendingRes, failedRes, recentRes] = await Promise.all([
    supabase.from("payments").select("amount").eq("status", "succeeded"),
    supabase.from("payments").select("id", { count: "exact" }).eq("status", "pending"),
    supabase.from("payments").select("amount").eq("status", "failed"),
    supabase
      .from("payments")
      .select("id, amount, status, created_at, delivery_request_id, user_id")
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  const totalRevenue = allPaymentsRes.data?.reduce((s, p) => s + (p.amount ?? 0), 0) ?? 0
  const pendingCount = pendingRes.count ?? 0
  const failedAmount = failedRes.data?.reduce((s, p) => s + (p.amount ?? 0), 0) ?? 0
  const payments = recentRes.data ?? []

  return (
    <div className="px-8 py-8 min-h-screen bg-[#131313]">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h3 className="text-2xl font-bold font-headline text-white mb-1">Transactions</h3>
          <p className="text-[#adaaaa] text-sm">Detailed log of all financial movements.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#1a1919] px-4 py-2 rounded-lg border border-[#494847]/10 text-sm">
            <span className="material-symbols-outlined text-sm text-[#adaaaa]">filter_list</span>
            <span className="text-white">Status: All</span>
          </div>
          <div className="flex items-center gap-2 bg-[#1a1919] px-4 py-2 rounded-lg border border-[#494847]/10 text-sm">
            <span className="material-symbols-outlined text-sm text-[#adaaaa]">calendar_today</span>
            <span className="text-white">Last 30 Days</span>
          </div>
          <button className="bg-[#262626] hover:bg-[#2c2c2c] px-4 py-2 rounded-lg transition-colors text-sm font-semibold text-white">
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Bento Grid */}
      <div className="grid grid-cols-12 gap-6 mb-8">
        {/* Large Focus Card */}
        <div className="col-span-12 lg:col-span-6 bg-[#1a1919] p-8 rounded-xl relative overflow-hidden flex flex-col justify-between h-[200px]">
          <div className="z-10">
            <p className="text-[#adaaaa] text-sm font-medium mb-1">Total Revenue (MTD)</p>
            <h2 className="text-5xl font-extrabold text-[#a3a6ff] font-headline tracking-tight">
              ${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
          </div>
          <div className="z-10 flex items-center gap-4">
            <div className="flex items-center gap-1 text-[#c180ff] text-sm font-semibold">
              <span className="material-symbols-outlined text-xs">trending_up</span>
              <span>+12.4% vs last month</span>
            </div>
            <div className="h-1 w-1 rounded-full bg-[#494847]" />
            <p className="text-[#adaaaa] text-sm">{payments.length} Recent Payments</p>
          </div>
          <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-[#a3a6ff]/10 to-transparent pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-[#a3a6ff]/5 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Secondary Stats */}
        <div className="col-span-12 lg:col-span-3 space-y-5">
          <div className="bg-[#1a1919] p-6 rounded-xl flex flex-col justify-center" style={{ height: "92px" }}>
            <p className="text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold mb-1">Pending Payouts</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-white font-headline">{pendingCount}</h3>
              <span className="text-xs text-[#adaaaa]">awaiting</span>
            </div>
          </div>
          <div className="bg-[#1a1919] p-6 rounded-xl flex flex-col justify-center" style={{ height: "92px" }}>
            <p className="text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold mb-1">Failed Charges</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-[#ff6e84] font-headline">
                ${failedAmount.toFixed(2)}
              </h3>
              <span className="text-xs text-[#adaaaa]">failed</span>
            </div>
          </div>
        </div>

        {/* Processing Volume Bar Chart */}
        <div className="col-span-12 lg:col-span-3 bg-[#1a1919] p-6 rounded-xl flex flex-col justify-between">
          <div>
            <p className="text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold mb-1">Processing Volume</p>
            <p className="text-xs text-[#adaaaa]">Real-time throughput</p>
          </div>
          <div className="flex items-end gap-1 h-16">
            {[40, 60, 85, 50, 100, 70, 30].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm"
                style={{
                  height: `${h}%`,
                  backgroundColor: i === 4 ? "#a3a6ff" : `rgba(163,166,255,${h / 150})`,
                  boxShadow: i === 4 ? "0px 0px 15px rgba(163,166,255,0.2)" : undefined,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-[#1a1919] rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#201f1f] text-[#adaaaa] text-[10px] uppercase tracking-[0.2em] font-bold">
                <th className="px-8 py-4">Payment ID</th>
                <th className="px-8 py-4">User / Recipient</th>
                <th className="px-8 py-4">Amount</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Date &amp; Time</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-transparent">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-[#adaaaa] text-sm">
                    No transactions found
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <PaymentRow key={payment.id} payment={payment} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PaymentRow({ payment }: { payment: any }) {
  const statusMap: Record<string, { label: string; dotClass: string; bgClass: string; textClass: string }> = {
    succeeded: {
      label: "Paid",
      dotClass: "bg-[#a3a6ff] shadow-[0px_0px_6px_rgba(163,166,255,0.6)]",
      bgClass: "bg-[#a3a6ff]/10",
      textClass: "text-[#a3a6ff]",
    },
    pending: {
      label: "Pending",
      dotClass: "bg-[#c180ff] animate-pulse",
      bgClass: "bg-[#c180ff]/10",
      textClass: "text-[#c180ff]",
    },
    failed: {
      label: "Failed",
      dotClass: "bg-[#ff6e84]",
      bgClass: "bg-[#ff6e84]/10",
      textClass: "text-[#ff6e84]",
    },
  }

  const config = statusMap[payment.status] ?? statusMap.pending
  const shortId = `#KV-${payment.id.slice(0, 5).toUpperCase()}`
  const dateObj = new Date(payment.created_at)
  const dateStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const timeStr = dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })

  return (
    <tr className="hover:bg-[#201f1f] transition-all group">
      <td className="px-8 py-5">
        <span className="font-mono text-xs text-[#a3a6ff]">{shortId}</span>
      </td>
      <td className="px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[#262626] flex items-center justify-center text-[#a3a6ff] font-bold text-xs">
            {(payment.user_id ?? "U").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Customer</p>
            <p className="text-[10px] text-[#adaaaa]">user@kinetic.io</p>
          </div>
        </div>
      </td>
      <td className="px-8 py-5">
        <span className="text-sm font-bold text-white">
          ${(payment.amount ?? 0).toFixed(2)}
        </span>
      </td>
      <td className="px-8 py-5">
        <span
          className={`px-2 py-1 ${config.bgClass} ${config.textClass} text-[10px] font-bold uppercase rounded tracking-wider flex items-center w-fit gap-1`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
          {config.label}
        </span>
      </td>
      <td className="px-8 py-5 text-sm text-[#adaaaa]">
        {dateStr}{" "}
        <span className="text-[10px] opacity-50 ml-1">{timeStr}</span>
      </td>
      <td className="px-8 py-5 text-right">
        <button className="material-symbols-outlined text-[#adaaaa] hover:text-white transition-colors">
          more_vert
        </button>
      </td>
    </tr>
  )
}
