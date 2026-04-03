import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DollarSign, Clock, CheckCircle, XCircle } from 'lucide-react'

export default function AdminPayoutsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Driver Payouts"
        description="Review and process pending driver payouts."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} title="Total Paid Out" />
        <StatCard icon={Clock} title="Pending" />
        <StatCard icon={CheckCircle} title="Processed" />
        <StatCard icon={XCircle} title="Failed" />
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
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">
                    No payouts found
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
