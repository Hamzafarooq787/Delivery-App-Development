import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/status-badge'
import { Search } from 'lucide-react'

export default function AdminDisputesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Disputes"
        description="Manage open disputes between customers and drivers."
      />

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search disputes..." className="pl-9" />
            </div>
            <div className="flex gap-2">
              {['All', 'Open', 'Resolved', 'Escalated'].map((filter) => (
                <Button
                  key={filter}
                  variant={filter === 'All' ? 'default' : 'outline'}
                  size="sm"
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 pr-4 font-medium">Dispute ID</th>
                  <th className="text-left py-3 pr-4 font-medium">Order</th>
                  <th className="text-left py-3 pr-4 font-medium">Raised By</th>
                  <th className="text-left py-3 pr-4 font-medium">Category</th>
                  <th className="text-left py-3 pr-4 font-medium">Status</th>
                  <th className="text-left py-3 pr-4 font-medium">Opened</th>
                  <th className="text-left py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">
                    No disputes found
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
