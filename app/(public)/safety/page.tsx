import { Shield, CheckCircle, AlertTriangle, Lock } from "lucide-react"

const safetyFeatures = [
  { icon: Shield, title: "Driver Background Checks", description: "All drivers undergo thorough background and criminal checks before joining the platform." },
  { icon: CheckCircle, title: "Identity Verification", description: "Every driver and customer is verified through government-issued ID validation." },
  { icon: Lock, title: "Secure Payments", description: "All transactions are encrypted and processed through PCI-compliant payment systems." },
  { icon: AlertTriangle, title: "24/7 Incident Reporting", description: "Our safety team is available around the clock to handle any reported incidents." },
]

export default function SafetyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 md:px-6">
      <div className="mb-12">
        <h1 className="text-3xl font-semibold text-foreground text-balance mb-4">Safety First</h1>
        <p className="text-base text-muted-foreground text-pretty leading-relaxed max-w-2xl">
          Your safety and the security of your deliveries are our top priorities. Here is how we protect you.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {safetyFeatures.map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-6 shadow-sm flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <f.icon className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">Report an Incident</h2>
        <div className="space-y-3">
          <div className="h-10 rounded-lg bg-secondary"></div>
          <div className="h-10 rounded-lg bg-secondary"></div>
          <div className="h-24 rounded-lg bg-secondary"></div>
          <div className="h-10 w-32 rounded-lg bg-foreground"></div>
        </div>
      </div>
    </div>
  )
}
