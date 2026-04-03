import { createClient } from "@/lib/supabase/server"
import { StatCard } from "@/components/shared/stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Package, Clock, MapPin, TrendingUp, Plus } from "lucide-react"
import Link from "next/link"

export default async function CustomerDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [deliveriesRes, addressesRes, paymentsRes] = await Promise.all([
    supabase
      .from("delivery_requests")
      .select("*")
      .eq("customer_id", user?.id ?? "")
      .order("created_at", { ascending: false }),
    supabase
      .from("addresses")
      .select("id")
      .eq("user_id", user?.id ?? ""),
    supabase
      .from("payments")
      .select("amount, delivery_requests!inner(customer_id)")
      .eq("delivery_requests.customer_id", user?.id ?? "")
      .eq("status", "succeeded"),
  ])

  const deliveries = deliveriesRes.data ?? []
  const addressCount = addressesRes.data?.length ?? 0
  const totalSpent = paymentsRes.data?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0
  const activeOrders = deliveries.filter((d) => !["completed", "cancelled"].includes(d.status)).length
  const recentOrders = deliveries.slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Overview of your deliveries">
        <Button size="sm" asChild>
          <Link href="/customer/new-delivery"><Plus className="mr-1.5 h-4 w-4" />New Delivery</Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Orders" icon={Package} value={String(deliveries.length)} description="All time" />
        <StatCard title="Active Orders" icon={Clock} value={String(activeOrders)} description="In progress" />
        <StatCard title="Saved Addresses" icon={MapPin} value={String(addressCount)} description="Locations" />
        <StatCard title="Total Spent" icon={TrendingUp} value={`$${totalSpent.toFixed(2)}`} description="All time" />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Recent Orders</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/customer/orders">View all</Link>
          </Button>
        </div>
        {recentOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">No orders yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Place your first delivery to get started.</p>
            <Button size="sm" asChild>
              <Link href="/customer/new-delivery">New Delivery</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Tracking #</th>
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
                    <td className="px-5 py-3.5 text-sm font-mono text-foreground">{order.tracking_number}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground max-w-[140px] truncate">{order.pickup_address}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground max-w-[140px] truncate">{order.delivery_address}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={order.status} /></td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
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
        )}
      </div>
    </div>
  )
}
