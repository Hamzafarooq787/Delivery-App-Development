"use client"

import { useState } from "react"

type ExportPayload = {
  generatedAt: string
  summary: {
    totalOrders: number
    recentOrders: number
    totalRevenue: string
    activeDrivers: number
    newCustomers: number
  }
  daily7: { label: string; revenue: number; orders: number }[]
  statusBreakdown: Record<string, number>
  topDrivers: { name: string; email: string; completed: number }[]
}

export function ReportsExportButton({ payload }: { payload: ExportPayload }) {
  const [open, setOpen] = useState(false)

  function exportCSV() {
    setOpen(false)
    const lines: string[][] = []

    // Summary
    lines.push(["=== PLATFORM ANALYTICS REPORT ==="])
    lines.push(["Generated", new Date(payload.generatedAt).toLocaleString("en-GB")])
    lines.push([])
    lines.push(["SUMMARY"])
    lines.push(["Total Orders (all time)", String(payload.summary.totalOrders)])
    lines.push(["Orders (last 30d)",       String(payload.summary.recentOrders)])
    lines.push(["Total Revenue (£)",        payload.summary.totalRevenue])
    lines.push(["Active Drivers",           String(payload.summary.activeDrivers)])
    lines.push(["New Customers (30d)",      String(payload.summary.newCustomers)])
    lines.push([])

    // 7-day daily
    lines.push(["7-DAY DAILY BREAKDOWN"])
    lines.push(["Day", "Revenue (£)", "Orders"])
    for (const d of payload.daily7) lines.push([d.label, d.revenue.toFixed(2), String(d.orders)])
    lines.push([])

    // Status breakdown
    lines.push(["STATUS BREAKDOWN"])
    lines.push(["Status", "Count"])
    for (const [status, count] of Object.entries(payload.statusBreakdown)) lines.push([status, String(count)])
    lines.push([])

    // Top drivers
    lines.push(["TOP FIELD AGENTS"])
    lines.push(["Rank", "Name", "Email", "Completed Deliveries"])
    payload.topDrivers.forEach((d, i) => lines.push([String(i + 1), d.name, d.email, String(d.completed)]))

    const csv  = lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = `analytics-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportJSON() {
    setOpen(false)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = `analytics-report-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-[#1a1919] border border-[#494847]/20 px-4 py-2.5 rounded-xl hover:border-[#a3a6ff]/40 transition-colors"
      >
        <span className="material-symbols-outlined text-sm text-[#a3a6ff]">download</span>
        <span className="text-white text-sm font-semibold">Export</span>
        <span className="material-symbols-outlined text-xs text-[#adaaaa]">{open ? "expand_less" : "expand_more"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-44 bg-[#1a1919] border border-[#494847]/20 rounded-xl shadow-2xl overflow-hidden">
          <button
            onClick={exportCSV}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-[#262626] transition-colors text-left"
          >
            <span className="material-symbols-outlined text-[#a3a6ff] text-[18px]">table_chart</span>
            Export CSV
          </button>
          <button
            onClick={exportJSON}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-[#262626] transition-colors text-left border-t border-[#494847]/10"
          >
            <span className="material-symbols-outlined text-[#c180ff] text-[18px]">data_object</span>
            Export JSON
          </button>
        </div>
      )}
    </div>
  )
}
