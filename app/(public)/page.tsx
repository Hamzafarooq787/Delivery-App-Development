import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Package, Truck, Shield, Clock, MapPin, ArrowRight, ChevronRight } from "lucide-react"

const features = [
  {
    icon: Clock,
    title: "Real-Time Tracking",
    description: "Track your delivery from pickup to drop-off with live updates.",
  },
  {
    icon: Shield,
    title: "Fully Insured",
    description: "All deliveries are covered with comprehensive insurance protection.",
  },
  {
    icon: Truck,
    title: "Verified Drivers",
    description: "Every driver is background-checked, trained, and certified.",
  },
  {
    icon: MapPin,
    title: "Wide Coverage",
    description: "We operate across major cities with expanding coverage areas.",
  },
]

const steps = [
  { step: "01", title: "Book a Delivery", description: "Enter pickup and drop-off details in seconds." },
  { step: "02", title: "Driver Assigned", description: "A verified driver accepts and heads to pickup." },
  { step: "03", title: "Track Live", description: "Monitor your delivery in real time on the map." },
  { step: "04", title: "Delivered", description: "Receive confirmation once the parcel is delivered." },
]

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center py-24 px-4 text-center bg-background border-b border-border">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground"></span>
            Fast &amp; Reliable Delivery Platform
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold text-foreground text-balance leading-tight mb-6">
            Deliver Anything,<br />Anywhere
          </h1>
          <p className="text-base md:text-lg text-muted-foreground text-pretty leading-relaxed mb-10 max-w-lg mx-auto">
            Connect with trusted drivers for fast, safe, and affordable delivery of your parcels and packages.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">Get Started <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/how-it-works">How It Works</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold text-foreground text-balance mb-3">Why Choose SwiftDeliver?</h2>
            <p className="text-sm text-muted-foreground text-pretty max-w-md mx-auto leading-relaxed">
              Built with reliability and security at its core for every delivery.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-background p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary mb-4">
                  <f.icon className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-background border-b border-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold text-foreground text-balance mb-3">How It Works</h2>
            <p className="text-sm text-muted-foreground text-pretty leading-relaxed">
              Four simple steps to get your delivery done.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((s) => (
              <div key={s.step} className="flex flex-col gap-3">
                <span className="text-3xl font-bold text-border">{s.step}</span>
                <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-foreground">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-semibold text-background text-balance mb-4">
            Ready to get started?
          </h2>
          <p className="text-sm text-background/60 mb-8 leading-relaxed">
            Join thousands of customers and drivers using SwiftDeliver every day.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/signup">Create an Account <ChevronRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="border-background/20 text-background hover:bg-background/10 hover:text-background" asChild>
              <Link href="/track/demo">Track a Package</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
