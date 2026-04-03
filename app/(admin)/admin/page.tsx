import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
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

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Platform-wide overview and key metrics."
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package} title="Total Orders" />
        <StatCard icon={Users} title="Total Customers" />
        <StatCard icon={Car} title="Active Drivers" />
        <StatCard icon={DollarSign} title="Revenue (MTD)" />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} title="Orders Today" />
        <StatCard icon={CheckCircle} title="Completed" />
        <StatCard icon={Clock} title="Pending" />
        <StatCard icon={AlertTriangle} title="Disputes Open" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Order ID</th>
                    <th className="text-left py-2 pr-4 font-medium">Customer</th>
                    <th className="text-left py-2 pr-4 font-medium">Status</th>
                    <th className="text-left py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground text-sm">
                      No orders yet
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Driver Applications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Pending Driver Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Name</th>
                    <th className="text-left py-2 pr-4 font-medium">Submitted</th>
                    <th className="text-left py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-muted-foreground text-sm">
                      No pending applications
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
