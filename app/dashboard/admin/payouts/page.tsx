import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { DollarSign, Clock, CheckCircle, XCircle } from "lucide-react"

export default async function AdminPayoutsPage() {
  const supabase = await createClient()

  const { data: payouts } = await supabase
    .from("payouts")
    .select("*, users(full_name, email)")
    .order("created_at", { ascending: false })

  const rows = payouts ?? []

  const totalPaid = rows.filter((p) => p.status === "paid").reduce((s, p) => s + (p.amount ?? 0), 0)
  const pendingCount = rows.filter((p) => p.status === "pending").length
  const processedCount = rows.filter((p) => p.status === "paid").length
  const failedCount = rows.filter((p) => p.status === "failed").length

  const statusMap: Record<string, "paid" | "pending" | "cancelled"> = {
    paid: "paid",
    pending: "pending",
    failed: "cancelled",
    cancelled: "cancelled",
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Driver Payouts" description="Review and process pending driver payouts." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} title="Total Paid Out" value={`£${totalPaid.toFixed(2)}`} />
        <StatCard icon={Clock} title="Pending" value={String(pendingCount)} />
        <StatCard icon={CheckCircle} title="Processed" value={String(processedCount)} />
        <StatCard icon={XCircle} title="Failed" value={String(failedCount)} />
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex justify-end mb-4">
            <Button size="sm">Process All Pending</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 pr-4 font-medium">Payout ID</th>
                  <th className="text-left py-3 pr-4 font-medium">Driver</th>
                  <th className="text-left py-3 pr-4 font-medium">Amount</th>
                  <th className="text-left py-3 pr-4 font-medium">Method</th>
                  <th className="text-left py-3 pr-4 font-medium">Status</th>
                  <th className="text-left py-3 pr-4 font-medium">Date</th>
                  <th className="text-left py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-muted-foreground">No payouts found.</td>
                  </tr>
                ) : (
                  rows.map((p) => {
                    const driver = p.users as { full_name?: string; email?: string } | null
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4 font-mono text-xs">{p.id.slice(0, 8).toUpperCase()}</td>
                        <td className="py-3 pr-4">
                          <p className="font-medium">{driver?.full_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{driver?.email ?? ""}</p>
                        </td>
                        <td className="py-3 pr-4 font-medium">
                          {p.amount != null ? `£${Number(p.amount).toFixed(2)}` : "—"}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{p.method ?? "—"}</td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={statusMap[p.status] ?? "pending"} />
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="py-3">
                          {p.status === "pending" && (
                            <Button variant="outline" size="sm">Process</Button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
