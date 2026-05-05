import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default async function PayoutsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [earningsRes, payoutsRes] = await Promise.all([
    supabase
      .from("driver_earnings")
      .select("amount")
      .eq("driver_id", user?.id ?? ""),
    supabase
      .from("payouts")
      .select("*")
      .eq("driver_id", user?.id ?? "")
      .order("created_at", { ascending: false }),
  ])

  const totalEarned = (earningsRes.data ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
  const totalPaidOut = (payoutsRes.data ?? [])
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + (p.amount ?? 0), 0)
  const pendingBalance = totalEarned - totalPaidOut
  const payouts = payoutsRes.data ?? []

  const statusMap: Record<string, "paid" | "pending" | "cancelled"> = {
    paid: "paid",
    pending: "pending",
    cancelled: "cancelled",
    failed: "cancelled",
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payouts" description="Manage your payout methods and history.">
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />Add Method
        </Button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm max-w-md">
        <h2 className="text-sm font-semibold text-foreground mb-3">Pending Balance</h2>
        <p className="text-3xl font-bold text-foreground">${pendingBalance.toFixed(2)}</p>
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
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No payout history yet.</td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-mono text-foreground">{p.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-foreground">
                      {p.amount != null ? `$${Number(p.amount).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{p.method ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={statusMap[p.status] ?? "pending"} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
