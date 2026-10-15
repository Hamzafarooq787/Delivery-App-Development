"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface StatusEntry {
  status: string
  count: number
}

const STATUS_COLORS: Record<string, string> = {
  pending: "var(--color-secondary)",
  assigned: "var(--brand-strong)",
  in_transit: "var(--color-tertiary)",
  delivered: "var(--brand-strong)",
  cancelled: "#ff6e84",
  completed: "var(--brand-strong)",
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--color-surface-container-high)] border border-[var(--color-outline-variant)]/20 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-white font-bold text-sm capitalize">{payload[0]?.name}</p>
      <p className="text-[var(--color-on-surface-variant)] text-xs">{payload[0]?.value} deliveries</p>
    </div>
  )
}

export function OrderStatusChart({ data }: { data: StatusEntry[] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--color-on-surface-variant)] text-sm">
        No status data yet
      </div>
    )
  }

  const chartData = data.map((d) => ({
    name: d.status.replace(/_/g, " "),
    value: d.count,
    color: STATUS_COLORS[d.status] ?? "var(--color-outline-variant)",
  }))

  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} opacity={0.85} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-3 space-y-2">
        {chartData.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-[var(--color-on-surface-variant)] text-[10px] capitalize">{entry.name}</span>
            </div>
            <span className="text-white text-[10px] font-bold">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

