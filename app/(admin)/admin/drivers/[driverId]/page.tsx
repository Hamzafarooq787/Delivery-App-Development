import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { ArrowLeft, User, Car, FileText, DollarSign } from 'lucide-react'
import Link from 'next/link'

export default async function AdminDriverDetailPage({
  params,
}: {
  params: Promise<{ driverId: string }>
}) {
  const { driverId } = await params

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/drivers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title={`Driver #${driverId}`}
          description="Driver profile, documents, and job history."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {['Full Name', 'Email', 'Phone', 'Joined', 'City', 'Postcode'].map((label) => (
                <div key={label}>
                  <p className="text-muted-foreground">{label}</p>
                  <p className="font-medium text-muted-foreground/50">—</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Vehicle */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Car className="h-4 w-4" />
                Vehicle
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {['Type', 'Make & Model', 'Year', 'Registration', 'Insurance Expiry', 'MOT Expiry'].map(
                (label) => (
                  <div key={label}>
                    <p className="text-muted-foreground">{label}</p>
                    <p className="font-medium text-muted-foreground/50">—</p>
                  </div>
                ),
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">Document</th>
                      <th className="text-left py-2 pr-4 font-medium">Status</th>
                      <th className="text-left py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['Driving Licence', 'Insurance', 'MOT Certificate', 'Profile Photo'].map(
                      (doc) => (
                        <tr key={doc} className="border-b last:border-0">
                          <td className="py-3 pr-4">{doc}</td>
                          <td className="py-3 pr-4">
                            <StatusBadge status="pending" />
                          </td>
                          <td className="py-3">
                            <Button variant="ghost" size="sm">Review</Button>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Verification Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <StatusBadge status="pending" />
              <div className="space-y-2 pt-2">
                <Button className="w-full" size="sm">Approve Driver</Button>
                <Button variant="outline" className="w-full" size="sm">Reject</Button>
                <Button variant="outline" className="w-full" size="sm">Suspend Account</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Earnings Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {['Total Earned', 'Jobs Completed', 'Average Rating', 'Pending Payout'].map((label) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-muted-foreground/50">—</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
