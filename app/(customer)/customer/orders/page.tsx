import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Plus, Search, Filter } from "lucide-react"
import Link from "next/link"

const orders = [
  { id: "ORD-001", from: "—", to: "—", status: "pending" as const, date: "—", amount: "—" },
  { id: "ORD-002", from: "—", to: "—", status: "in_transit" as const, date: "—", amount: "—" },
  { id: "ORD-003", from: "—", to: "—", status: "completed" as const, date: "—", amount: "—" },
  { id: "ORD-004", from: "—", to: "—", status: "cancelled" as const, date: "—", amount: "—" },
  { id: "ORD-005", from: "—", to: "—", status: "completed" as const, date: "—", amount: "—" },
]

export default function OrdersPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My Orders" description="View and manage all your deliveries.">
        <Button size="sm" asChild>
          <Link href="/customer/new-delivery"><Plus className="mr-1.5 h-4 w-4" />New Delivery</Link>
        </Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search orders..."
            className="w-full h-9 rounded-lg border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button variant="outline" size="sm" className="shrink-0">
          <Filter className="mr-1.5 h-4 w-4" />Filter
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Order ID</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">From</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">To</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Amount</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono font-medium text-foreground">{order.id}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{order.from}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{order.to}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={order.status} /></td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{order.date}</td>
                  <td className="px-5 py-3.5 text-sm text-foreground">{order.amount}</td>
                  <td className="px-5 py-3.5">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/customer/orders/${order.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
