import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

const payouts = [
  { id: "PAY-001", date: "—", amount: "—", method: "—", status: "paid" as const },
  { id: "PAY-002", date: "—", amount: "—", method: "—", status: "pending" as const },
  { id: "PAY-003", date: "—", amount: "—", method: "—", status: "paid" as const },
]

export default function PayoutsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payouts" description="Manage your payout methods and history.">
        <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add Method</Button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm max-w-md">
        <h2 className="text-sm font-semibold text-foreground mb-3">Pending Balance</h2>
        <p className="text-3xl font-bold text-foreground">—</p>
        <p className="text-xs text-muted-foreground mt-1">Available for withdrawal</p>
        <Button size="sm" className="mt-4">Request Payout</Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Payout History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Payout ID</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Amount</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Method</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono text-foreground">{p.id}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{p.date}</td>
                  <td className="px-5 py-3.5 text-sm text-foreground">{p.amount}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{p.method}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
