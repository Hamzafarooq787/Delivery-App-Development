import type { Metadata } from "next"
import { ContactForm } from "./contact-form"

export const metadata: Metadata = {
  title: "Contact | Go Drop",
  description: "Get in touch with the Go Drop operations center. We&apos;re here to handle your most demanding logistical challenges.",
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      {/* Hero */}
      <section className="relative w-full overflow-hidden pt-24 sm:pt-32 pb-12 sm:pb-16">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_center,rgba(163,166,255,0.06),transparent_60%)] pointer-events-none" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-2xl mx-auto">
            <span className="inline-block px-4 py-1 rounded-full bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 text-[#a3a6ff] text-xs font-bold tracking-widest uppercase mb-6">
              Mission Control
            </span>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black font-headline tracking-tighter mb-4 sm:mb-6 text-balance break-words">
              Contact the <span className="text-[#a3a6ff] italic">Operations Center</span>
            </h1>
            <p className="text-base sm:text-lg text-[#adaaaa] leading-relaxed">
              Our team is deployed globally, ready to handle your most critical logistical requirements. Send a signal.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20 sm:pb-32 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <ContactForm />

        {/* Info Panel */}
        <div className="flex flex-col gap-4">
          {[
            {
              icon: "📡",
              colorClass: "bg-[#a3a6ff]/10 text-[#a3a6ff]",
              title: "Operations Email",
              value: "ops@godrop.io",
              sub: "Response within 2 hours",
            },
            {
              icon: "📞",
              colorClass: "bg-[#c180ff]/10 text-[#c180ff]",
              title: "Priority Hotline",
              value: "+44 800 GO DROP",
              sub: "24/7 for premium clients",
            },
            {
              icon: "📍",
              colorClass: "bg-[#a3a6ff]/10 text-[#a3a6ff]",
              title: "HQ",
              value: "United Kingdom",
              sub: "By appointment only",
            },
            {
              icon: "⏱️",
              colorClass: "bg-[#c180ff]/10 text-[#c180ff]",
              title: "Operational Hours",
              value: "00:00 – 23:59 UTC",
              sub: "Always on, always moving",
            },
          ].map((item) => (
            <div key={item.title} className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/10 flex gap-5 items-start hover:border-[#494847]/25 transition-colors">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${item.colorClass}`}>
                {item.icon}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold mb-1">{item.title}</p>
                <p className="text-white font-semibold">{item.value}</p>
                <p className="text-xs text-[#adaaaa] mt-1">{item.sub}</p>
              </div>
            </div>
          ))}

          {/* SLA Note */}
          <div className="bg-[#a3a6ff]/5 border border-[#a3a6ff]/15 rounded-2xl p-6">
            <h4 className="font-bold text-[#a3a6ff] mb-2 flex items-center gap-2 text-sm">
              ⚡ Priority Support
            </h4>
            <p className="text-xs text-[#adaaaa] leading-relaxed">
              Premium clients receive a dedicated escalation path with guaranteed response windows and a named account manager.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
