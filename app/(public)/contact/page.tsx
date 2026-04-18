import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact | Kinetic Void",
  description: "Get in touch with the Kinetic Void operations center. We&apos;re here to handle your most demanding logistical challenges.",
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      {/* Hero */}
      <section className="pt-32 pb-16 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,rgba(163,166,255,0.06),transparent_60%)] pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto">
          <span className="inline-block px-4 py-1 rounded-full bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 text-[#a3a6ff] text-xs font-bold tracking-widest uppercase mb-6">
            Mission Control
          </span>
          <h1 className="text-5xl md:text-6xl font-black font-headline tracking-tighter mb-6 text-balance">
            Contact the <span className="text-[#a3a6ff] italic">Operations Center</span>
          </h1>
          <p className="text-lg text-[#adaaaa] leading-relaxed">
            Our team is deployed globally, ready to handle your most critical logistical requirements. Send a signal.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-6 pb-32 grid lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2 bg-[#1a1919] rounded-3xl p-8 md:p-12 border border-[#494847]/15">
          <h2 className="text-2xl font-bold font-headline mb-8">Transmit a Message</h2>
          <form className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-2">First Name</label>
                <input
                  type="text"
                  placeholder="Marcus"
                  className="w-full h-12 bg-black/40 border border-[#494847]/20 rounded-xl px-4 text-sm text-white placeholder:text-[#adaaaa]/40 outline-none focus:border-[#a3a6ff]/50 focus:ring-1 focus:ring-[#a3a6ff]/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-2">Last Name</label>
                <input
                  type="text"
                  placeholder="Chen"
                  className="w-full h-12 bg-black/40 border border-[#494847]/20 rounded-xl px-4 text-sm text-white placeholder:text-[#adaaaa]/40 outline-none focus:border-[#a3a6ff]/50 focus:ring-1 focus:ring-[#a3a6ff]/20 transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-2">Email Address</label>
              <input
                type="email"
                placeholder="ops@yourcompany.com"
                className="w-full h-12 bg-black/40 border border-[#494847]/20 rounded-xl px-4 text-sm text-white placeholder:text-[#adaaaa]/40 outline-none focus:border-[#a3a6ff]/50 focus:ring-1 focus:ring-[#a3a6ff]/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-2">Subject</label>
              <select className="w-full h-12 bg-black/40 border border-[#494847]/20 rounded-xl px-4 text-sm text-white outline-none focus:border-[#a3a6ff]/50 focus:ring-1 focus:ring-[#a3a6ff]/20 transition-colors">
                <option className="bg-[#1a1919]" value="">Select a topic...</option>
                <option className="bg-[#1a1919]">Enterprise Partnership</option>
                <option className="bg-[#1a1919]">Technical Support</option>
                <option className="bg-[#1a1919]">Billing Inquiry</option>
                <option className="bg-[#1a1919]">Damage Claim</option>
                <option className="bg-[#1a1919]">Custom Fleet Request</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-2">Message</label>
              <textarea
                rows={6}
                placeholder="Describe your logistical requirements in detail. The more data you provide, the faster we can mobilize a response."
                className="w-full bg-black/40 border border-[#494847]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#adaaaa]/40 outline-none focus:border-[#a3a6ff]/50 focus:ring-1 focus:ring-[#a3a6ff]/20 transition-colors resize-none"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#a3a6ff] text-[#0f00a4] font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(163,166,255,0.2)] hover:brightness-110 active:scale-95 transition-all uppercase tracking-widest text-sm"
            >
              Transmit Signal
            </button>
          </form>
        </div>

        {/* Info Panel */}
        <div className="flex flex-col gap-4">
          {[
            {
              icon: "📡",
              colorClass: "bg-[#a3a6ff]/10 text-[#a3a6ff]",
              title: "Operations Email",
              value: "ops@kineticvoid.io",
              sub: "Response within 2 hours",
            },
            {
              icon: "📞",
              colorClass: "bg-[#c180ff]/10 text-[#c180ff]",
              title: "Priority Hotline",
              value: "+1 (800) KV-FLEET",
              sub: "24/7 for Quantum tier clients",
            },
            {
              icon: "📍",
              colorClass: "bg-[#a3a6ff]/10 text-[#a3a6ff]",
              title: "Global Nexus HQ",
              value: "1 Void Plaza, San Francisco",
              sub: "By appointment only",
            },
            {
              icon: "⏱️",
              colorClass: "bg-[#c180ff]/10 text-[#c180ff]",
              title: "Operational Hours",
              value: "00:00 – 23:59 UTC",
              sub: "The void never sleeps",
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
              ⚡ Enterprise SLA
            </h4>
            <p className="text-xs text-[#adaaaa] leading-relaxed">
              Quantum tier clients receive a dedicated escalation path with guaranteed response windows and a named account engineer.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
