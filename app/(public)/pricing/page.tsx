import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const plans = [
  {
    name: "Standard",
    price: "$4.99",
    description: "For occasional senders with basic delivery needs.",
    features: ["Up to 5kg", "Same-day delivery", "Basic tracking", "Email notifications"],
    cta: "Get Started",
    featured: false,
  },
  {
    name: "Express",
    price: "$9.99",
    description: "For frequent senders who need faster delivery.",
    features: ["Up to 15kg", "2-hour express delivery", "Live GPS tracking", "SMS + Email notifications", "Priority support"],
    cta: "Get Started",
    featured: true,
  },
  {
    name: "Business",
    price: "Custom",
    description: "For businesses with high delivery volume.",
    features: ["Unlimited weight", "Scheduled pickups", "Advanced dashboard", "API integration", "Dedicated account manager", "SLA guarantee"],
    cta: "Contact Sales",
    featured: false,
  },
]

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-semibold text-foreground text-balance mb-4">Simple Pricing</h1>
        <p className="text-base text-muted-foreground text-pretty leading-relaxed max-w-xl mx-auto">
          Transparent, flat-rate pricing with no hidden fees. Pay only for what you use.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-xl border p-6 shadow-sm flex flex-col gap-5 ${
              plan.featured ? "border-foreground bg-foreground text-background" : "border-border bg-card"
            }`}
          >
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${plan.featured ? "text-background/60" : "text-muted-foreground"}`}>
                {plan.name}
              </p>
              <p className={`text-3xl font-bold mb-1 ${plan.featured ? "text-background" : "text-foreground"}`}>
                {plan.price}
                {plan.price !== "Custom" && <span className={`text-sm font-normal ${plan.featured ? "text-background/60" : "text-muted-foreground"}`}>/delivery</span>}
              </p>
              <p className={`text-sm leading-relaxed ${plan.featured ? "text-background/70" : "text-muted-foreground"}`}>
                {plan.description}
              </p>
            </div>
            <ul className="flex flex-col gap-2 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className={`h-4 w-4 shrink-0 ${plan.featured ? "text-background" : "text-foreground"}`} />
                  <span className={plan.featured ? "text-background/80" : "text-muted-foreground"}>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              variant={plan.featured ? "secondary" : "outline"}
              size="sm"
              className="w-full"
              asChild
            >
              <Link href="/signup">{plan.cta}</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
