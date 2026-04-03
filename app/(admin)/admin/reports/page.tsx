import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Package,
  Car,
  Users,
  DollarSign,
  TrendingUp,
  Star,
  Clock,
  AlertTriangle,
} from 'lucide-react'

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Reports"
          description="Platform-wide analytics and downloadable reports."
        />
        <Button variant="outline" size="sm">Export CSV</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package} title="Orders (30d)" />
        <StatCard icon={DollarSign} title="Revenue (30d)" />
        <StatCard icon={Car} title="Active Drivers" />
        <StatCard icon={Users} title="New Customers" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Order Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Chart placeholder</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Revenue Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Chart placeholder</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Orders by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Chart placeholder</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Top Drivers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Driver</th>
                    <th className="text-left py-2 pr-4 font-medium">Jobs</th>
                    <th className="text-left py-2 font-medium">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-muted-foreground">
                      No data
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
