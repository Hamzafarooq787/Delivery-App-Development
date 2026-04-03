import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { CreditCard, Plus, Trash2 } from "lucide-react"

const paymentMethods = [
  { id: 1, type: "Visa", last4: "••••", expiry: "••/••", default: true },
  { id: 2, type: "Mastercard", last4: "••••", expiry: "••/••", default: false },
]

export default function PaymentMethodsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payment Methods" description="Manage your saved payment cards.">
        <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add Card</Button>
      </PageHeader>

      <div className="flex flex-col gap-3 max-w-xl">
        {paymentMethods.map((pm) => (
          <div key={pm.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <CreditCard className="h-5 w-5 text-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{pm.type} ending in {pm.last4}</p>
              <p className="text-xs text-muted-foreground">Expires {pm.expiry}</p>
            </div>
            {pm.default && (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground">Default</span>
            )}
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {/* Add new card form placeholder */}
        <div className="rounded-xl border border-dashed border-border bg-card p-6">
          <h3 className="text-sm font-medium text-foreground mb-4">Add New Card</h3>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Card Number</label>
              <input type="text" placeholder="•••• •••• •••• ••••" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Expiry</label>
                <input type="text" placeholder="MM/YY" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">CVV</label>
                <input type="text" placeholder="•••" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <Button size="sm">Save Card</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
