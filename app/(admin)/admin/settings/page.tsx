import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Platform Settings"
        description="Configure global platform settings and policies."
      />

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'Platform Name', placeholder: 'SwiftDeliver' },
            { label: 'Support Email', placeholder: 'support@example.com' },
            { label: 'Support Phone', placeholder: '+44 ...' },
          ].map(({ label, placeholder }) => (
            <div key={label} className="space-y-1.5">
              <Label>{label}</Label>
              <Input placeholder={placeholder} />
            </div>
          ))}
          <Button size="sm">Save General</Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Pricing & Fees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'Base Fare (£)', placeholder: '0.00' },
            { label: 'Per Mile Rate (£)', placeholder: '0.00' },
            { label: 'Platform Commission (%)', placeholder: '0' },
            { label: 'Driver Payout Share (%)', placeholder: '0' },
          ].map(({ label, placeholder }) => (
            <div key={label} className="space-y-1.5">
              <Label>{label}</Label>
              <Input placeholder={placeholder} type="number" />
            </div>
          ))}
          <Button size="sm">Save Pricing</Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Notification Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            'Order Confirmed',
            'Driver Assigned',
            'Out for Delivery',
            'Order Delivered',
            'Order Cancelled',
          ].map((template) => (
            <div key={template} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm">{template}</span>
              <Button variant="ghost" size="sm">Edit</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
