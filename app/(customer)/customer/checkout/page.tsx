import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Package, MapPin, CreditCard } from "lucide-react"
import Link from "next/link"

export default function CheckoutPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/customer/new-delivery"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>
      </div>
      <PageHeader title="Checkout" description="Review your order and complete payment." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Order Summary */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Package className="h-4 w-4" />Order Summary
            </h2>
            <div className="space-y-3">
              {["Pickup Address", "Delivery Address", "Package Type", "Weight", "Service"].map((field) => (
                <div key={field} className="flex justify-between items-center py-1">
                  <span className="text-sm text-muted-foreground">{field}</span>
                  <div className="h-4 w-32 rounded bg-secondary"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />Payment Method
            </h2>
            <div className="space-y-2">
              {["Saved Card (ending ••••)", "Add New Card"].map((option) => (
                <label key={option} className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-secondary transition-colors">
                  <input type="radio" name="payment" className="h-4 w-4" />
                  <span className="text-sm text-foreground">{option}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Price Summary */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm h-fit">
          <h2 className="text-sm font-semibold text-foreground mb-4">Price Breakdown</h2>
          <div className="space-y-2.5 mb-4">
            {["Base Rate", "Distance Fee", "Service Fee", "Tax"].map((item) => (
              <div key={item} className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{item}</span>
                <div className="h-4 w-14 rounded bg-secondary"></div>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-3 flex justify-between items-center mb-5">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <div className="h-5 w-16 rounded bg-secondary"></div>
          </div>
          <Button className="w-full" size="sm">Confirm &amp; Pay</Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Secured by 256-bit encryption
          </p>
        </div>
      </div>
    </div>
  )
}
