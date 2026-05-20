import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ProcessPayoutButton, ProcessAllButton } from "@/components/admin/process-payout-buttons"

function fmt(n: number) {
  return `£${n.toFixed(2)}`
}

export const dynamic = "force-dynamic"

export default async function AdminPayoutsPage() {
  const admin = createAdminClient()

  // Get all payout requests (from payouts table)
  const { data: payoutRows } = await admin
    .from("payouts")
    .select("id, driver_id, amount, status, created_at, users(full_name, email)")
    .order("created_at", { ascending: false })

  const payouts = payoutRows ?? []

  // Get all driver_earnings to build per-driver pending balances
  const { data: earningsRows } = await admin
    .from("driver_earnings")
    .select("driver_id, amount, commission_amount, status")

  const earnings = earningsRows ?? []

  // Aggregate pending earnings by driver
  const pendingByDriver: Record<string, { pending: number; total: number; jobs: number }> = {}
  for (const e of earnings) {
    if (!e.driver_id) continue
    if (!pendingByDriver[e.driver_id]) pendingByDriver[e.driver_id] = { pending: 0, total: 0, jobs: 0 }
    pendingByDriver[e.driver_id].total += e.amount ?? 0
    pendingByDriver[e.driver_id].jobs += 1
    if (e.status === "pending") pendingByDriver[e.driver_id].pending += e.amount ?? 0
  }

  // Get driver user info
  const driverIds = Object.keys(pendingByDriver)
  const { data: driverUsers } = driverIds.length
    ? await admin.from("users").select("id, full_name, email").in("id", driverIds)
    : { data: [] }

  const driverMap: Record<string, { full_name?: string; email?: string }> = {}
  for (const u of driverUsers ?? []) driverMap[u.id] = u

  const pendingDriverList = driverIds
    .filter((id) => pendingByDriver[id].pending > 0)
    .map((id) => ({
      driverId: id,
      ...driverMap[id],
      ...pendingByDriver[id],
    }))
    .sort((a, b) => b.pending - a.pending)

  // Summary stats
  const totalAllEarnings    = earnings.reduce((s, e) => s + (e.amount ?? 0), 0)
  const totalPendingBalance = earnings.filter(e => e.status === "pending").reduce((s, e) => s + (e.amount ?? 0), 0)
  const totalCommission     = earnings.reduce((s, e) => s + (e.commission_amount ?? 0), 0)
  const totalProcessed      = payouts.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount ?? 0), 0)
  const pendingPayoutCount  = payouts.filter(p => p.status === "pending").length

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[#131313]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight text-white">Driver Payouts</h2>
          <p className="text-[#adaaaa] mt-1 text-sm">Review pending balances and process driver disbursements.</p>
        </div>
        {pendingPayoutCount > 0 && <ProcessAllButton count={pendingPayoutCount} />}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-6 md:mb-8">
        <div className="bg-[#1a1919] p-6 rounded-xl border-l-4 border-[#a3a6ff]">
          <p className="text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold mb-2">Total Earned (Drivers)</p>
          <p className="text-2xl font-black font-headline text-white">{fmt(totalAllEarnings)}</p>
          <p className="text-xs text-[#adaaaa] mt-1">{earnings.length} deliveries</p>
        </div>
        <div className="bg-[#1a1919] p-6 rounded-xl border-l-4 border-[#c180ff]">
          <p className="text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold mb-2">Pending Balance</p>
          <p className="text-2xl font-black font-headline text-[#c180ff]">{fmt(totalPendingBalance)}</p>
          <p className="text-xs text-[#adaaaa] mt-1">{pendingDriverList.length} drivers waiting</p>
        </div>
        <div className="bg-[#1a1919] p-6 rounded-xl border-l-4 border-[#6ee7b7]">
          <p className="text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold mb-2">Total Processed</p>
          <p className="text-2xl font-black font-headline text-[#6ee7b7]">{fmt(totalProcessed)}</p>
          <p className="text-xs text-[#adaaaa] mt-1">{payouts.filter(p => p.status === "paid").length} payouts</p>
        </div>
        <div className="bg-[#1a1919] p-6 rounded-xl border-l-4 border-[#ff6e84]">
          <p className="text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold mb-2">Platform Commission</p>
          <p className="text-2xl font-black font-headline text-white">{fmt(totalCommission)}</p>
          <p className="text-xs text-[#adaaaa] mt-1">25% of all fares</p>
        </div>
      </div>

      {/* Pending Balances per Driver */}
      {pendingDriverList.length > 0 && (
        <div className="bg-[#1a1919] rounded-xl overflow-hidden mb-6">
          <div className="px-6 py-5 border-b border-[#494847]/10 flex items-center justify-between">
            <div>
              <h3 className="font-headline text-base font-bold text-white">Pending Driver Balances</h3>
              <p className="text-xs text-[#adaaaa] mt-0.5">Earnings awaiting disbursement</p>
            </div>
            <span className="text-xs font-bold text-[#c180ff] bg-[#c180ff]/10 px-3 py-1 rounded-full">
              {pendingDriverList.length} drivers
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="bg-[#201f1f]/50 text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4 text-left">Driver</th>
                  <th className="px-6 py-4 text-right">Total Earned</th>
                  <th className="px-6 py-4 text-right">Pending</th>
                  <th className="px-6 py-4 text-right">Jobs</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#494847]/10">
                {pendingDriverList.map((d) => (
                  <tr key={d.driverId} className="hover:bg-[#201f1f] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#a3a6ff]/10 flex items-center justify-center text-[#a3a6ff] text-xs font-bold shrink-0">
                          {(d.full_name ?? d.email ?? "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{d.full_name ?? "—"}</p>
                          <p className="text-xs text-[#adaaaa]">{d.email ?? ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-[#adaaaa]">{fmt(d.total)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-[#c180ff]">{fmt(d.pending)}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-[#adaaaa]">{d.jobs}</td>
                    <td className="px-6 py-4 text-right">
                      <ProcessPayoutButton driverId={d.driverId} amount={d.pending} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payout history */}
      <div className="bg-[#1a1919] rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-[#494847]/10">
          <h3 className="font-headline text-base font-bold text-white">Payout Request History</h3>
          <p className="text-xs text-[#adaaaa] mt-0.5">All payout requests submitted by drivers</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="bg-[#201f1f]/50 text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold">
                <th className="px-6 py-4 text-left">Payout ID</th>
                <th className="px-6 py-4 text-left">Driver</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-right">Status</th>
                <th className="px-6 py-4 text-right">Date</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#494847]/10">
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-[#adaaaa] text-sm">No payout requests yet.</td>
                </tr>
              ) : (
                payouts.map((p) => {
                  const driver = p.users as { full_name?: string; email?: string } | null
                  const isPaid = p.status === "paid"
                  return (
                    <tr key={p.id} className="hover:bg-[#201f1f] transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-[#a3a6ff]">#{p.id.slice(0, 8).toUpperCase()}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-white">{driver?.full_name ?? "—"}</p>
                        <p className="text-xs text-[#adaaaa]">{driver?.email ?? ""}</p>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-black text-white">{fmt(p.amount ?? 0)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded ${
                          isPaid
                            ? "bg-[#6ee7b7]/10 text-[#6ee7b7]"
                            : "bg-[#c180ff]/10 text-[#c180ff]"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? "bg-[#6ee7b7]" : "bg-[#c180ff] animate-pulse"}`} />
                          {isPaid ? "Disbursed" : "Processing"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-[#adaaaa]">
                        {new Date(p.created_at).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!isPaid && <ProcessPayoutButton payoutId={p.id} amount={p.amount ?? 0} markExisting />}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
