"use client"

import { useState } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { ChevronRight, Package, MapPin, Scale, CreditCard } from "lucide-react"

const steps = [
  { id: 1, label: "Pickup Details", icon: MapPin },
  { id: 2, label: "Delivery Details", icon: MapPin },
  { id: 3, label: "Package Info", icon: Package },
  { id: 4, label: "Review & Pay", icon: CreditCard },
]

export default function NewDeliveryPage() {
  const [currentStep, setCurrentStep] = useState(1)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="New Delivery" description="Book a new delivery in a few simple steps." />

      {/* Step Indicator */}
      <div className="flex items-center gap-0">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => setCurrentStep(step.id)}
              className="flex flex-col items-center gap-1.5"
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                step.id === currentStep
                  ? "bg-foreground text-background"
                  : step.id < currentStep
                  ? "bg-secondary text-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}>
                {step.id}
              </div>
              <span className={`text-xs hidden sm:block ${step.id === currentStep ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-2 ${step.id < currentStep ? "bg-foreground" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Pickup Details</h3>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Pickup Address</label>
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
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Contact Name</label>
              <input type="text" placeholder="Sender name" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Contact Phone</label>
              <input type="tel" placeholder="+1 (555) 000-0000" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Delivery Details</h3>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Delivery Address</label>
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
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Recipient Name</label>
              <input type="text" placeholder="Recipient name" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Recipient Phone</label>
              <input type="tel" placeholder="+1 (555) 000-0000" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Package Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Weight (kg)</label>
                <input type="number" placeholder="0.0" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Package Type</label>
                <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  <option>Select type</option>
                  <option>Document</option>
                  <option>Parcel</option>
                  <option>Fragile</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Package Description</label>
              <textarea
                placeholder="Brief description of the package contents..."
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Service Type</label>
              {["Standard (3-5 hrs)", "Express (1-2 hrs)", "Scheduled"].map((type) => (
                <label key={type} className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-secondary transition-colors">
                  <input type="radio" name="service" className="h-4 w-4" />
                  <span className="text-sm text-foreground">{type}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Order Summary</h3>
            <div className="rounded-lg bg-secondary p-4 space-y-3">
              {["Pickup Address", "Delivery Address", "Package Type", "Service", "Weight"].map((field) => (
                <div key={field} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{field}</span>
                  <div className="h-3.5 w-24 rounded bg-border"></div>
                </div>
              ))}
              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="text-sm font-medium text-foreground">Estimated Total</span>
                <div className="h-4 w-16 rounded bg-border"></div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6 pt-5 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => setCurrentStep(Math.max(1, currentStep - 1))} disabled={currentStep === 1}>
            Back
          </Button>
          {currentStep < 4 ? (
            <Button size="sm" onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}>
              Continue <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm">Confirm &amp; Pay</Button>
          )}
        </div>
      </div>
    </div>
  )
}
