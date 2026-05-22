"use client"

import { useEffect, useMemo, useState } from "react"
import { adminGetCustomers } from "@/app/actions/delivery"
import Link from "next/link"

const ACCENT_COLORS = [
  { bg: "bg-[#a3a6ff]/10", text: "text-[#a3a6ff]" },
  { bg: "bg-[#c180ff]/10", text: "text-[#c180ff]" },
  { bg: "bg-[#ff6e84]/10", text: "text-[#ff6e84]" },
  { bg: "bg-[#ffa5d9]/10", text: "text-[#ffa5d9]" },
]

type Customer = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  delivery_count: number
  total_spend: number
}

type Tab = "active" | "inactive"
const PAGE_SIZE = 10

export default function AdminCustomersPage() {
  const [rows, setRows]       = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<Tab>("active")
  const [query, setQuery]     = useState("")
  const [page, setPage]       = useState(1)

  useEffect(() => {
    adminGetCustomers().then(({ data }) => {
      setRows((data ?? []) as Customer[])
      setLoading(false)
    })
  }, [])

  // Active = has at least 1 order, Inactive = no orders
  const filtered = useMemo(() => {
    const byTab = rows.filter((c) => tab === "active" ? c.delivery_count > 0 : c.delivery_count === 0)
    const q = query.trim().toLowerCase()
    if (!q) return byTab
    return byTab.filter((c) =>
      (c.full_name ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q)
    )
  }, [rows, tab, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [tab, query])

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
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Search */}
          <div className="flex items-center gap-2 bg-[#1a1919] border border-[#494847]/20 rounded-lg px-3 py-2">
            <span className="material-symbols-outlined text-[#adaaaa] text-[16px]">search</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, phone…"
              className="bg-transparent text-white text-xs placeholder-[#494847] outline-none w-40"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-[#adaaaa] hover:text-white">
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
          {/* Tab filter */}
          <div className="flex bg-[#1a1919] p-1 rounded-full border border-[#494847]/10">
            <button
              onClick={() => setTab("active")}
              className={`px-5 sm:px-6 py-1.5 rounded-full text-xs font-bold transition-all ${tab === "active" ? "bg-[#a3a6ff] text-[#0f00a4]" : "text-[#adaaaa] hover:text-white"}`}
            >
              Active Hubs
            </button>
            <button
              onClick={() => setTab("inactive")}
              className={`px-5 sm:px-6 py-1.5 rounded-full text-xs font-bold transition-all ${tab === "inactive" ? "bg-[#a3a6ff] text-[#0f00a4]" : "text-[#adaaaa] hover:text-white"}`}
            >
              Inactive
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1a1919] rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-[#adaaaa] text-sm">Loading customers…</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#201f1f]/50">
                    {["Client Identity", "Communication", "Operational Volume", "Aggregate Spend", "Status"].map((h, i) => (
                      <th
                        key={h}
                        className={`px-6 lg:px-8 py-5 text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold ${i === 3 ? "text-right" : i === 4 ? "text-center" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#494847]/5">
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-[#adaaaa] text-sm">
                        {query ? "No customers match your search." : tab === "active" ? "No active customers found." : "No inactive customers found."}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((customer, index) => {
                      const accent   = ACCENT_COLORS[index % ACCENT_COLORS.length]
                      const name     = customer.full_name || customer.email || "?"
                      const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
                      return (
                        <Link
                          key={customer.id}
                          href={`/dashboard/admin/customers/${customer.id}`}
                          className="group cursor-pointer hover:bg-[#262626] transition-colors contents"
                        >
                          <tr className="group cursor-pointer hover:bg-[#262626] transition-colors">
                            <td className="px-6 lg:px-8 py-5">
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-lg ${accent.bg} flex items-center justify-center ${accent.text} font-headline font-bold text-sm shrink-0`}>
                                  {initials}
                                </div>
                                <div>
                                  <p className="text-white font-semibold text-sm group-hover:text-[#a3a6ff] transition-colors">{customer.full_name || "Unknown"}</p>
                                  <p className="text-[#adaaaa] text-xs">ID: KV-{customer.id.slice(0, 5).toUpperCase()}</p>
                                </div>
                              </div>
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
                        </Link>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-[#494847]/10">
              {pageRows.length === 0 ? (
                <p className="py-12 text-center text-[#adaaaa] text-sm">No customers found</p>
              ) : (
                pageRows.map((customer, index) => {
                  const accent   = ACCENT_COLORS[index % ACCENT_COLORS.length]
                  const name     = customer.full_name || customer.email || "?"
                  const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
                  return (
                    <Link
                      key={customer.id}
                      href={`/dashboard/admin/customers/${customer.id}`}
                      className="flex items-center gap-4 px-4 py-4 hover:bg-[#262626] transition-colors"
                    >
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
                      <span className="material-symbols-outlined text-[#a3a6ff] text-lg shrink-0">chevron_right</span>
                    </Link>
                  )
                })
              )}
            </div>

            {/* Pagination */}
            <div className="px-4 md:px-8 py-4 bg-[#201f1f]/30 flex items-center justify-between">
              <p className="text-xs text-[#adaaaa]">
                {filtered.length === 0
                  ? "No results"
                  : `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="p-1.5 rounded-lg bg-[#262626] text-white hover:text-[#a3a6ff] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <span className="flex items-center text-xs text-[#adaaaa] px-2">{safePage} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="p-1.5 rounded-lg bg-[#262626] text-white hover:text-[#a3a6ff] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
