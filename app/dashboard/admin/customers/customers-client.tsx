"use client"

import { useState } from "react"
import Link from "next/link"

const ACCENT_COLORS = [
  { bg: "bg-[#a3a6ff]/10", text: "text-[#a3a6ff]" },
  { bg: "bg-[#c180ff]/10", text: "text-[#c180ff]" },
  { bg: "bg-[#ff6e84]/10", text: "text-[#ff6e84]" },
  { bg: "bg-[#ffa5d9]/10", text: "text-[#ffa5d9]" },
]

type CustomerRow = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  delivery_count: number
  total_spend: number
}

export function CustomersClient({ rows }: { rows: CustomerRow[] }) {
  const [tab, setTab] = useState<"active" | "inactive">("active")

  const filtered = rows.filter((c) =>
    tab === "active" ? c.delivery_count > 0 : c.delivery_count === 0
  )

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[#131313]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 md:mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-headline font-black tracking-tight text-white">Customer Entities</h1>
          <p className="text-[#adaaaa] mt-2 text-sm">
            Manage global accounts, commercial spending, and ledger status.
          </p>
        </div>
        <div className="flex bg-[#1a1919] p-1 rounded-full self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTab("active")}
            className={`px-5 sm:px-6 py-1.5 rounded-full text-xs font-bold transition-all ${
              tab === "active" ? "bg-[#a3a6ff] text-[#0f00a4]" : "text-[#adaaaa] hover:text-white"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setTab("inactive")}
            className={`px-5 sm:px-6 py-1.5 rounded-full text-xs font-bold transition-all ${
              tab === "inactive" ? "bg-[#a3a6ff] text-[#0f00a4]" : "text-[#adaaaa] hover:text-white"
            }`}
          >
            Inactive
          </button>
        </div>
      </div>

      {/* Table — desktop */}
      <div className="bg-[#1a1919] rounded-xl overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#201f1f]/50">
                {["Client Identity", "Communication", "Operational Volume", "Aggregate Spend", "Status"].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`px-6 lg:px-8 py-5 text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold ${
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-[#adaaaa] text-sm">
                    No {tab} customers found
                  </td>
                </tr>
              ) : (
                filtered.map((customer, index) => {
                  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length]
                  const name = customer.full_name || customer.email || "?"
                  const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()

                  return (
                    <tr key={customer.id} className="group cursor-pointer hover:bg-[#262626] transition-colors">
                      <td className="px-6 lg:px-8 py-5">
                        <Link href={`/dashboard/admin/customers/${customer.id}`} className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg ${accent.bg} flex items-center justify-center ${accent.text} font-headline font-bold text-sm shrink-0`}>
                            {initials}
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">{customer.full_name || "Unknown"}</p>
                            <p className="text-[#adaaaa] text-xs">ID: KV-{customer.id.slice(0, 5).toUpperCase()}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 lg:px-8 py-5">
                        <p className="text-white text-sm">{customer.email || "—"}</p>
                        <p className="text-[#adaaaa] text-xs">{customer.phone ?? "—"}</p>
                      </td>
                      <td className="px-6 lg:px-8 py-5">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm">{customer.delivery_count}</span>
                          <span className={`text-[10px] ${accent.text} ${accent.bg} px-1.5 py-0.5 rounded font-bold`}>
                            {customer.delivery_count === 1 ? "Order" : "Orders"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 lg:px-8 py-5 text-right">
                        <p className="text-white font-headline font-bold text-sm">£{customer.total_spend.toFixed(2)}</p>
                        <p className="text-[10px] text-[#adaaaa]">LTM Spend</p>
                      </td>
                      <td className="px-6 lg:px-8 py-5">
                        <div className="flex justify-center">
                          <div className={`w-2 h-2 rounded-full ${customer.delivery_count > 0 ? "bg-[#a3a6ff] shadow-[0px_0px_8px_rgba(163,166,255,0.6)]" : "bg-[#494847]"}`} />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-[#494847]/10">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-[#adaaaa] text-sm">No {tab} customers found</p>
          ) : (
            filtered.map((customer, index) => {
              const accent = ACCENT_COLORS[index % ACCENT_COLORS.length]
              const name = customer.full_name || customer.email || "?"
              const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
              return (
                <Link key={customer.id} href={`/dashboard/admin/customers/${customer.id}`} className="flex items-center gap-4 px-4 py-4 hover:bg-[#262626] transition-colors">
                  <div className={`w-10 h-10 rounded-lg ${accent.bg} flex items-center justify-center ${accent.text} font-headline font-bold text-sm shrink-0`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{customer.full_name || "Unknown"}</p>
                    <p className="text-[#adaaaa] text-xs truncate">{customer.email || "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white font-bold text-sm">£{customer.total_spend.toFixed(2)}</p>
                    <p className="text-[#adaaaa] text-[10px]">{customer.delivery_count} orders</p>
                  </div>
                </Link>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 md:px-8 py-4 bg-[#201f1f]/30 flex items-center justify-between">
          <p className="text-xs text-[#adaaaa]">
            {filtered.length} of {rows.length} customers
          </p>
        </div>
      </div>
    </div>
  )
}
