import { createClient } from "@/lib/supabase/server"
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  Package,
  Users,
  Car,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    ordersRes,
    customersRes,
    activeDriversRes,
    paymentsRes,
    ordersToday,
    completedRes,
    pendingRes,
    disputesRes,
    recentOrdersRes,
    pendingDriversRes,
  ] = await Promise.all([
    supabase.from("delivery_requests").select("id", { count: "exact" }),
    supabase.from("users").select("id", { count: "exact" }).eq("role", "customer"),
    supabase.from("driver_profiles").select("id", { count: "exact" }).eq("status", "approved"),
    supabase.from("payments").select("amount").eq("status", "succeeded"),
    supabase.from("delivery_requests").select("id", { count: "exact" }).gte("created_at", today.toISOString()),
    supabase.from("delivery_requests").select("id", { count: "exact" }).eq("status", "completed"),
    supabase.from("delivery_requests").select("id", { count: "exact" }).eq("status", "pending"),
    supabase.from("disputes").select("id", { count: "exact" }).eq("status", "open"),
    supabase.from("delivery_requests").select("id, tracking_number, customer_id, status, price, created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("driver_profiles").select("id, created_at, users(full_name)").eq("status", "pending").limit(5),
  ])

  const revenue = paymentsRes.data?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Platform-wide overview and key metrics."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package} title="Total Orders" value={String(ordersRes.count ?? 0)} description="All time" />
        <StatCard icon={Users} title="Total Customers" value={String(customersRes.count ?? 0)} description="Registered" />
        <StatCard icon={Car} title="Active Drivers" value={String(activeDriversRes.count ?? 0)} description="Approved" />
        <StatCard icon={DollarSign} title="Revenue (MTD)" value={`$${revenue.toFixed(2)}`} description="Month to date" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} title="Orders Today" value={String(ordersToday.count ?? 0)} description="Since midnight" />
        <StatCard icon={CheckCircle} title="Completed" value={String(completedRes.count ?? 0)} description="All time" />
        <StatCard icon={Clock} title="Pending" value={String(pendingRes.count ?? 0)} description="Awaiting driver" />
        <StatCard icon={AlertTriangle} title="Disputes Open" value={String(disputesRes.count ?? 0)} description="Needs attention" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-5 font-medium">Tracking #</th>
                    <th className="text-left py-2 px-5 font-medium">Status</th>
                    <th className="text-left py-2 px-5 font-medium">Price</th>
                    <th className="text-left py-2 px-5 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentOrdersRes.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground text-sm">No orders yet</td>
                    </tr>
                  ) : (
                    (recentOrdersRes.data ?? []).map((order) => (
                      <tr key={order.id} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
                        <td className="py-3 px-5 font-mono text-foreground">{order.tracking_number}</td>
                        <td className="py-3 px-5"><StatusBadge status={order.status} /></td>
                        <td className="py-3 px-5 text-foreground">${(order.price ?? 0).toFixed(2)}</td>
                        <td className="py-3 px-5 text-muted-foreground whitespace-nowrap">{new Date(order.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Pending Driver Applications</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-5 font-medium">Name</th>
                    <th className="text-left py-2 px-5 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {(pendingDriversRes.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-8 text-center text-muted-foreground text-sm">No pending applications</td>
                    </tr>
                  ) : (
                    (pendingDriversRes.data ?? []).map((driver: any) => (
                      <tr key={driver.id} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
                        <td className="py-3 px-5 text-foreground">{driver.users?.full_name ?? "—"}</td>
                        <td className="py-3 px-5 text-muted-foreground whitespace-nowrap">{new Date(driver.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

