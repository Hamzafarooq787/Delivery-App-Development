import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { MapPin, Plus, Trash2, Home, Briefcase } from "lucide-react"

const addresses = [
  { id: 1, label: "Home", icon: Home, address: "—", city: "—", default: true },
  { id: 2, label: "Work", icon: Briefcase, address: "—", city: "—", default: false },
]

export default function AddressesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Saved Addresses" description="Manage your frequently used locations.">
        <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add Address</Button>
      </PageHeader>

      <div className="flex flex-col gap-3 max-w-xl">
        {addresses.map((addr) => (
          <div key={addr.id} className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <addr.icon className="h-5 w-5 text-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-medium text-foreground">{addr.label}</p>
                {addr.default && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">Default</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{addr.address}</p>
              <p className="text-xs text-muted-foreground">{addr.city}</p>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <div className="rounded-xl border border-dashed border-border bg-card p-6">
          <h3 className="text-sm font-medium text-foreground mb-4">Add New Address</h3>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Label</label>
              <input type="text" placeholder="e.g. Home, Office" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Street Address</label>
              <input type="text" placeholder="Street address" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">City</label>
                <input type="text" placeholder="City" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Postal Code</label>
                <input type="text" placeholder="Postal code" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <Button size="sm">Save Address</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
