import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Pricing | Go Drop",
  description: "Choose your tier of logistical supremacy. Transparent, competitive pricing for every scale of operation.",
}

const plans = [
  {
    name: "Reactive",
    tagline: "For occasional movers.",
    price: "Pay As You Go",
    sub: "No monthly commitment",
    color: "text-[#adaaaa]",
    glow: "",
    features: [
      "Standard Ground Delivery",
      "Basic Package Tracking",
      "Email Support",
      "Up to 10 shipments/month",
      "Max 20kg per parcel",
    ],
    disabledFeatures: ["Priority Dispatch", "Dedicated Account Manager", "Climate-Controlled Fleet"],
    cta: "Get Started",
    ctaStyle: "bg-[#262626] text-white hover:bg-[#333] border border-[#494847]/30",
    popular: false,
  },
  {
    name: "Kinetic",
    tagline: "The standard for serious operators.",
    price: "$299",
    sub: "/month",
    color: "text-[var(--color-primary)]",
    glow: "shadow-[0_0_40px_rgba(var(--brand-rgb),0.2)] border-[var(--color-primary)]/40",
    features: [
      "Flash 2-Hour Delivery",
      "Real-Time GPS Telemetry",
      "Priority Dispatch Queue",
      "Up to 200 shipments/month",
      "Max 200kg per parcel",
      "24/7 Ops Center Support",
    ],
    disabledFeatures: ["Dedicated Account Manager"],
    cta: "Choose Kinetic",
    ctaStyle: "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:brightness-110",
    popular: true,
  },
  {
    name: "Quantum",
    tagline: "Absolute logistical dominance.",
    price: "$999",
    sub: "/month",
    color: "text-[var(--color-secondary)]",
    glow: "shadow-[0_0_40px_rgba(var(--brand-rgb),0.1)] border-[var(--color-secondary)]/20",
    features: [
      "Quantum Instant Delivery",
      "End-to-End Encryption",
      "Dedicated Account Manager",
      "Unlimited shipments",
      "No weight restrictions",
      "Climate-Controlled Fleet",
      "SLA-Backed Guarantees",
    ],
    disabledFeatures: [],
    cta: "Contact Sales",
    ctaStyle: "bg-[var(--color-secondary)] text-[var(--color-on-secondary)] hover:brightness-110",
    popular: false,
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      {/* Hero */}
      <section className="text-center pt-28 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,rgba(var(--brand-rgb),0.08),transparent_60%)] pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <span className="inline-block px-4 py-1 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs font-bold tracking-widest uppercase mb-6">
            Transparent Pricing
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black font-headline tracking-tighter mb-4 sm:mb-6 text-balance">
            Choose Your Tier of <span className="text-[var(--color-primary)] italic">Supremacy</span>
          </h1>
          <p className="text-base sm:text-lg text-[#adaaaa] max-w-2xl mx-auto leading-relaxed">
            From on-demand deliveries to enterprise-grade logistical architecture, Go Drop scales with your ambition.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-[#1a1919] rounded-3xl p-6 sm:p-8 border flex flex-col ${plan.popular ? plan.glow : "border-[#494847]/15"}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-1 bg-[var(--color-primary)] text-[var(--color-on-primary)] text-xs font-black uppercase tracking-widest rounded-full whitespace-nowrap">
                  Most Popular
                </div>
              )}
              <div className="mb-6 sm:mb-8">
                <h3 className={`text-3xl font-headline font-black mb-1 ${plan.color}`}>{plan.name}</h3>
                <p className="text-sm text-[#adaaaa]">{plan.tagline}</p>
              </div>
              <div className="mb-6 sm:mb-8">
                <span className="text-4xl sm:text-5xl font-black font-headline text-white">{plan.price}</span>
                <span className="text-[#adaaaa] text-sm ml-2">{plan.sub}</span>
              </div>
              <ul className="space-y-3 mb-8 sm:mb-10 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className={`flex items-start gap-3 text-sm text-white`}>
                    <span className={`mt-0.5 text-base ${plan.color}`}>✓</span>
                    {f}
                  </li>
                ))}
                {plan.disabledFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-[#494847]">
                    <span className="mt-0.5 text-base">✗</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.name === "Quantum" ? "/contact" : "/signup"}
                className={`block text-center font-bold py-4 px-8 rounded-xl transition-all active:scale-95 ${plan.ctaStyle}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Add-Ons */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-black font-headline tracking-tight">Mission-Critical Add-Ons</h2>
          <p className="text-[#adaaaa] mt-2">Extend any plan with precision-engineered upgrades.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: "🛡️", colorClass: "text-[var(--color-primary)] bg-[var(--color-primary)]/10", title: "Insurance Boost", desc: "Extend cargo liability coverage to $1M per shipment.", price: "+$49/mo", priceColor: "text-[var(--color-primary)]" },
            { icon: "🌡️", colorClass: "text-[var(--color-secondary)] bg-[var(--color-secondary)]/10", title: "Cryo-Vault", desc: "Active temperature regulation for pharmaceutical-grade cargo.", price: "+$99/mo", priceColor: "text-[var(--color-secondary)]" },
            { icon: "👁️", colorClass: "text-[var(--color-primary)] bg-[var(--color-primary)]/10", title: "Void Analytics Pro", desc: "Deep-dive operational intelligence and predictive forecasting.", price: "+$79/mo", priceColor: "text-[var(--color-primary)]" },
            { icon: "🤖", colorClass: "text-[var(--color-secondary)] bg-[var(--color-secondary)]/10", title: "AI Dispatch Brain", desc: "Let Kinetic AI fully automate your dispatch protocols.", price: "+$149/mo", priceColor: "text-[var(--color-secondary)]" },
            { icon: "🔐", colorClass: "text-[var(--color-primary)] bg-[var(--color-primary)]/10", title: "Quantum Encryption", desc: "Post-quantum cryptographic security for ultra-sensitive cargo.", price: "+$199/mo", priceColor: "text-[var(--color-primary)]" },
            { icon: "📞", colorClass: "text-[var(--color-secondary)] bg-[var(--color-secondary)]/10", title: "White-Glove Service", desc: "Personal logistics concierge available 24/7 via direct line.", price: "+$299/mo", priceColor: "text-[var(--color-secondary)]" },
          ].map((addon) => (
            <div key={addon.title} className="bg-[#1a1919] p-5 sm:p-6 rounded-2xl border border-[#494847]/10 hover:border-[#494847]/30 transition-colors flex gap-4 sm:gap-5">
              <div className={`flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl ${addon.colorClass}`}>
                {addon.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-sm text-white">{addon.title}</h4>
                  <span className={`text-xs font-bold ml-2 whitespace-nowrap ${addon.priceColor}`}>{addon.price}</span>
                </div>
                <p className="text-xs text-[#adaaaa]">{addon.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-20 sm:pb-32">
        <h2 className="text-2xl sm:text-3xl font-black font-headline text-center mb-8 sm:mb-12 tracking-tight">FAQ: Eliminating Ambiguity</h2>
        <div className="space-y-4">
          {[
            { q: "Can I upgrade or downgrade at any time?", a: "Yes. Your tier can be modified at any billing cycle boundary with no lock-in penalties. Go Drop believes in logistical freedom at every level." },
            { q: "What happens if I exceed my monthly shipment limit?", a: "Overage shipments are billed at standard pay-as-you-go rates. You will never experience service disruption for exceeding your quota." },
            { q: "Is there a free trial?", a: "All new accounts receive 5 free shipments on the Kinetic tier to experience our core capabilities. No credit card required." },
            { q: "How does the SLA-backed guarantee work on Quantum?", a: "If we miss a committed delivery window, you receive a service credit of 100% of the delivery cost. Our network maintains 99.9% on-time performance globally." },
          ].map((item) => (
            <details key={item.q} className="bg-[#1a1919] rounded-xl border border-[#494847]/10 group open:border-[var(--color-primary)]/30 transition-colors">
              <summary className="p-5 sm:p-6 cursor-pointer flex justify-between items-center font-semibold list-none gap-4">
                <span className="text-sm sm:text-base">{item.q}</span>
                <span className="text-[var(--color-primary)] transition-transform group-open:rotate-45 text-xl leading-none flex-shrink-0">+</span>
              </summary>
              <p className="px-5 sm:px-6 pb-5 sm:pb-6 text-sm text-[#adaaaa] leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}

