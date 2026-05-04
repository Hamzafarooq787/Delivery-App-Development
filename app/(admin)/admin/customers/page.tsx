import { createClient } from "@/lib/supabase/server"

const ACCENT_COLORS = [
  { bg: "bg-[#a3a6ff]/10", text: "text-[#a3a6ff]" },
  { bg: "bg-[#c180ff]/10", text: "text-[#c180ff]" },
  { bg: "bg-[#ff6e84]/10", text: "text-[#ff6e84]" },
  { bg: "bg-[#ffa5d9]/10", text: "text-[#ffa5d9]" },
]

export default async function AdminCustomersPage() {
  const supabase = await createClient()

  const { data: customers, count } = await supabase
    .from("users")
    .select("id, full_name, email, created_at, phone", { count: "exact" })
    .eq("role", "customer")
    .order("created_at", { ascending: false })
    .limit(20)

  const rows = customers ?? []

  return (
    <div className="px-8 py-8 min-h-screen bg-[#131313]">
      {/* Header */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="text-4xl font-headline font-black tracking-tight text-white">Customer Entities</h1>
          <p className="text-[#adaaaa] mt-2 text-sm">
            Manage global accounts, commercial spending, and ledger status.
          </p>
        </div>
        <div className="flex bg-[#1a1919] p-1 rounded-full">
          <button className="px-6 py-1.5 rounded-full bg-[#a3a6ff] text-[#0f00a4] text-xs font-bold transition-all">
            Active Hubs
          </button>
          <button className="px-6 py-1.5 rounded-full text-[#adaaaa] text-xs font-bold hover:text-white transition-all">
            Inactive
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1a1919] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#201f1f]/50">
                {["Client Identity", "Communication", "Operational Volume", "Aggregate Spend", "Status"].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`px-8 py-5 text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold ${
                        i === 3 ? "text-right" : i === 4 ? "text-center" : ""
                      }`}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#494847]/5">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-[#adaaaa] text-sm">
                    No customers found
                  </td>
                </tr>
              ) : (
                rows.map((customer, index) => {
                  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length]
                  const name = customer.full_name ?? customer.email ?? "?"
                  const initials = name
                    .split(" ")
                    .map((w: string) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()

                  return (
                    <tr key={customer.id} className="group cursor-pointer hover:bg-[#262626] transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-lg ${accent.bg} flex items-center justify-center ${accent.text} font-headline font-bold text-sm`}
                          >
                            {initials}
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">{customer.full_name ?? "Unknown"}</p>
                            <p className="text-[#adaaaa] text-xs">
                              ID: KV-{customer.id.slice(0, 5).toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-white text-sm">{customer.email}</p>
                        <p className="text-[#adaaaa] text-xs">{customer.phone ?? "—"}</p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm">—</span>
                          <span className={`text-[10px] ${accent.text} ${accent.bg} px-1.5 py-0.5 rounded font-bold`}>
                            Active
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <p className="text-white font-headline font-bold text-sm">—</p>
                        <p className="text-[10px] text-[#adaaaa]">LTM Spend</p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center">
                          <div className="w-2 h-2 rounded-full bg-[#a3a6ff] shadow-[0px_0px_8px_rgba(163,166,255,0.6)]" />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-8 py-4 bg-[#201f1f]/30 flex items-center justify-between">
          <p className="text-xs text-[#adaaaa]">
            Displaying {rows.length} of {count ?? 0} active nodes
          </p>
          <div className="flex gap-2">
            <button className="p-1.5 rounded-lg bg-[#262626] text-white hover:text-[#a3a6ff] transition-colors">
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <button className="p-1.5 rounded-lg bg-[#262626] text-white hover:text-[#a3a6ff] transition-colors">
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
