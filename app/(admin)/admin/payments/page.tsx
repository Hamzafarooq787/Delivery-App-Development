import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, TrendingUp, Clock, CheckCircle } from 'lucide-react'

export default function AdminPaymentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Track all customer payments and transactions."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} title="Total Revenue" />
        <StatCard icon={TrendingUp} title="Revenue (MTD)" />
        <StatCard icon={CheckCircle} title="Completed Payments" />
        <StatCard icon={Clock} title="Pending Payments" />
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 pr-4 font-medium">Transaction ID</th>
                  <th className="text-left py-3 pr-4 font-medium">Customer</th>
                  <th className="text-left py-3 pr-4 font-medium">Order</th>
                  <th className="text-left py-3 pr-4 font-medium">Method</th>
                  <th className="text-left py-3 pr-4 font-medium">Amount</th>
                  <th className="text-left py-3 pr-4 font-medium">Status</th>
                  <th className="text-left py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">
                    No transactions found
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
