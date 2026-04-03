import { Mail, Phone, MapPin, Clock } from "lucide-react"

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
      <div className="mb-12">
        <h1 className="text-3xl font-semibold text-foreground text-balance mb-4">Contact Us</h1>
        <p className="text-base text-muted-foreground text-pretty leading-relaxed max-w-xl">
          Have a question or need help? Our support team is here for you.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-base font-semibold text-foreground mb-5">Send a Message</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="h-4 w-16 rounded bg-secondary"></div>
                <div className="h-10 rounded-lg border border-border bg-background"></div>
              </div>
              <div className="space-y-1.5">
                <div className="h-4 w-16 rounded bg-secondary"></div>
                <div className="h-10 rounded-lg border border-border bg-background"></div>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-16 rounded bg-secondary"></div>
              <div className="h-10 rounded-lg border border-border bg-background"></div>
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-16 rounded bg-secondary"></div>
              <div className="h-32 rounded-lg border border-border bg-background"></div>
            </div>
            <div className="h-10 w-32 rounded-lg bg-foreground"></div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {[
            { icon: Mail, label: "Email", value: "support@swiftdeliver.com" },
            { icon: Phone, label: "Phone", value: "+1 (800) 000-0000" },
            { icon: MapPin, label: "Address", value: "123 Delivery St, City, Country" },
            { icon: Clock, label: "Hours", value: "Mon–Fri, 9am–6pm" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-border bg-card p-5 shadow-sm flex gap-4 items-start">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <item.icon className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">{item.label}</p>
                <p className="text-sm text-foreground">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
