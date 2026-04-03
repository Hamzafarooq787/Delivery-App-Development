import { StatCard } from "@/components/shared/stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Package, Clock, MapPin, TrendingUp, Plus } from "lucide-react"
import Link from "next/link"

const recentOrders = [
  { id: "ORD-001", from: "—", to: "—", status: "pending" as const, date: "—" },
  { id: "ORD-002", from: "—", to: "—", status: "in_transit" as const, date: "—" },
  { id: "ORD-003", from: "—", to: "—", status: "completed" as const, date: "—" },
]

export default function CustomerDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Overview of your deliveries">
        <Button size="sm" asChild>
          <Link href="/customer/new-delivery"><Plus className="mr-1.5 h-4 w-4" />New Delivery</Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Orders" icon={Package} value="—" description="All time" />
        <StatCard title="Active Orders" icon={Clock} value="—" description="In progress" />
        <StatCard title="Saved Addresses" icon={MapPin} value="—" description="Locations" />
        <StatCard title="Total Spent" icon={TrendingUp} value="—" description="All time" />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Recent Orders</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/customer/orders">View all</Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Order ID</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">From</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">To</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono text-foreground">{order.id}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{order.from}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{order.to}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={order.status} /></td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{order.date}</td>
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
