"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"

interface DataPoint {
  label: string
  revenue: number
  orders: number
}

interface RevenueChartProps {
  data: DataPoint[]
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#201f1f] border border-[#494847]/20 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-[#adaaaa] text-[10px] uppercase tracking-widest font-bold mb-2">{label}</p>
      <p className="text-[var(--color-primary)] font-bold text-sm">
        ${(payload[0]?.value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className="text-[var(--color-secondary)] text-xs">{payload[1]?.value ?? 0} orders</p>
    </div>
  )
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#494847" strokeOpacity={0.15} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#adaaaa", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#adaaaa", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v}`}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#494847", strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--color-primary)"
          strokeWidth={2}
          fill="url(#revGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "var(--color-primary)", strokeWidth: 0 }}
        />
        <Area
          type="monotone"
          dataKey="orders"
          stroke="var(--color-secondary)"
          strokeWidth={2}
          fill="url(#ordGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "var(--color-secondary)", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

