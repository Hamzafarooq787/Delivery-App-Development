import { StatCard } from "@/components/shared/stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { DollarSign, Briefcase, TrendingUp, Calendar } from "lucide-react"

export default function EarningsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Earnings" description="Track your earnings and delivery performance." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today" icon={DollarSign} value="—" description="Earnings today" />
        <StatCard title="This Week" icon={Calendar} value="—" description="7-day earnings" />
        <StatCard title="This Month" icon={TrendingUp} value="—" description="30-day earnings" />
        <StatCard title="Total Jobs" icon={Briefcase} value="—" description="All time" />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-4">Earnings Breakdown</h2>
        <div className="h-48 rounded-lg bg-secondary flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Chart placeholder</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Earnings History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Job ID</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-5 py-3.5"><div className="h-4 w-20 rounded bg-secondary"></div></td>
                  <td className="px-5 py-3.5"><div className="h-4 w-20 rounded bg-secondary"></div></td>
                  <td className="px-5 py-3.5"><div className="h-4 w-20 rounded bg-secondary"></div></td>
                  <td className="px-5 py-3.5"><div className="h-4 w-14 rounded bg-secondary"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
