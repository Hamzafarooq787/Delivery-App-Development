import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Filter } from 'lucide-react'

export default function AdminOrdersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="View and manage all platform orders."
      />

      <Card>
        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search orders..." className="pl-9" />
            </div>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 pr-4 font-medium">Order ID</th>
                  <th className="text-left py-3 pr-4 font-medium">Customer</th>
                  <th className="text-left py-3 pr-4 font-medium">Driver</th>
                  <th className="text-left py-3 pr-4 font-medium">Status</th>
                  <th className="text-left py-3 pr-4 font-medium">Date</th>
                  <th className="text-left py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    No orders found
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
