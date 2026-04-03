import { ArrowRight } from "lucide-react"

const steps = [
  {
    step: "01",
    title: "Create an Account",
    description: "Sign up as a customer or driver in minutes.",
    detail: "Provide your basic details and verify your email to get started.",
  },
  {
    step: "02",
    title: "Book a Delivery",
    description: "Enter pickup and destination details.",
    detail: "Add package details, select a service tier, and get an instant quote.",
  },
  {
    step: "03",
    title: "Driver Accepts",
    description: "A nearby verified driver accepts your request.",
    detail: "Our smart matching system finds the best available driver near you.",
  },
  {
    step: "04",
    title: "Live Tracking",
    description: "Monitor your delivery in real time.",
    detail: "Receive SMS and email updates at every stage of the delivery.",
  },
  {
    step: "05",
    title: "Delivered",
    description: "Parcel arrives safely at the destination.",
    detail: "Receive a proof of delivery photo and digital confirmation.",
  },
]

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 md:px-6">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-semibold text-foreground text-balance mb-4">How It Works</h1>
        <p className="text-base text-muted-foreground text-pretty leading-relaxed max-w-xl mx-auto">
          SwiftDeliver makes sending a delivery simple, transparent, and reliable in just a few steps.
        </p>
      </div>
      <div className="flex flex-col gap-6">
        {steps.map((s, i) => (
          <div key={s.step} className="flex gap-6 items-start">
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">
                {s.step}
              </div>
              {i < steps.length - 1 && <div className="mt-2 w-px flex-1 bg-border h-10"></div>}
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex-1 mb-2">
              <h3 className="text-sm font-semibold text-foreground mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              <p className="mt-2 text-xs text-muted-foreground/70">{s.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
