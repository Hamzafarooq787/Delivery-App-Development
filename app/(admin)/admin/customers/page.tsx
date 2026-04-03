import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Filter } from 'lucide-react'

export default function AdminCustomersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage all registered customer accounts."
      />
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search customers..." className="pl-9" />
            </div>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 pr-4 font-medium">Name</th>
                  <th className="text-left py-3 pr-4 font-medium">Email</th>
                  <th className="text-left py-3 pr-4 font-medium">Orders</th>
                  <th className="text-left py-3 pr-4 font-medium">Status</th>
                  <th className="text-left py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted-foreground">
                    No customers found
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
