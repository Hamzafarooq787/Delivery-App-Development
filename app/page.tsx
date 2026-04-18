import Link from "next/link"

const features = [
  {
    icon: "local_shipping",
    title: "Real-Time Tracking",
    description: "Monitor every shipment live with millisecond precision across our global network.",
  },
  {
    icon: "bolt",
    title: "Instant Dispatch",
    description: "Book a local courier in seconds. From package to pickup in under 3 minutes.",
  },
  {
    icon: "shield",
    title: "Insured & Secured",
    description: "Every delivery is fully insured and handled by vetted, certified logistics partners.",
  },
  {
    icon: "analytics",
    title: "Smart Analytics",
    description: "Deep insights into your shipping patterns, costs, and delivery performance.",
  },
  {
    icon: "flight",
    title: "Global Reach",
    description: "Same-day domestic and next-day international shipping to 190+ countries.",
  },
  {
    icon: "support_agent",
    title: "24/7 Support",
    description: "Dedicated logistics specialists available around the clock for every shipment.",
  },
]

const stats = [
  { value: "190+", label: "Countries Served" },
  { value: "1.2M+", label: "Deliveries Completed" },
  { value: "99.4%", label: "On-Time Rate" },
  { value: "< 3min", label: "Avg. Dispatch Time" },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white overflow-x-hidden">
      {/* Background ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-0">
        <div className="absolute -top-60 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-[#a3a6ff]/4 blur-[140px]" />
        <div className="absolute top-1/2 -left-40 w-[500px] h-[500px] rounded-full bg-[#c180ff]/3 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[#a3a6ff]/3 blur-[100px]" />
      </div>

      {/* ── NAV ── */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 lg:px-24 py-6 border-b border-[#262626]/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#a3a6ff] text-xl">bolt</span>
          </div>
          <span className="font-headline font-extrabold text-lg tracking-tight">KINETIC VOID</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#adaaaa]">
          <Link href="/how-it-works" className="hover:text-white transition-colors">How It Works</Link>
          <Link href="/fleet" className="hover:text-white transition-colors">Fleet</Link>
          <Link href="/about" className="hover:text-white transition-colors">About</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-[#adaaaa] hover:text-white transition-colors px-4 py-2"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="milled-gradient text-white text-sm font-bold px-5 py-2.5 rounded-full hover:opacity-90 active:scale-95 transition-all glow-primary"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-24 pb-28">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-[#a3a6ff]/8 border border-[#a3a6ff]/15 text-[#a3a6ff] text-xs font-bold uppercase tracking-widest rounded-full px-4 py-2 mb-10">
          <span className="w-1.5 h-1.5 rounded-full bg-[#a3a6ff] animate-pulse" />
          Now serving 190+ countries worldwide
        </div>

        <h1 className="font-headline font-extrabold text-5xl md:text-7xl lg:text-8xl tracking-tighter leading-[1.0] text-balance max-w-5xl mb-8">
          Logistics at the{" "}
          <span className="bg-clip-text text-transparent milled-gradient">Speed of Light</span>
        </h1>

        <p className="text-[#adaaaa] text-lg md:text-xl max-w-2xl leading-relaxed mb-12 text-balance">
          Kinetic Void bridges the gap between you and your destination with precision-engineered delivery solutions. From microscopic components to industrial fleets.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/signup"
            className="milled-gradient text-white font-bold text-base px-8 py-4 rounded-full flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all glow-primary shadow-[0_0_40px_rgba(163,166,255,0.15)]"
          >
            <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
            Start Shipping Free
          </Link>
          <Link
            href="/how-it-works"
            className="flex items-center gap-2 text-[#adaaaa] hover:text-white font-semibold text-base px-6 py-4 rounded-full border border-[#262626] hover:border-[#a3a6ff]/30 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">play_circle</span>
            See How It Works
          </Link>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="relative z-10 border-y border-[#262626]/60 bg-[#131313]/50">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-[#262626]/60">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center justify-center py-10 px-6 gap-2">
              <span className="font-headline font-extrabold text-3xl md:text-4xl text-white">{stat.value}</span>
              <span className="text-xs font-semibold text-[#adaaaa] uppercase tracking-widest text-center">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative z-10 px-6 md:px-12 lg:px-24 py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-[#a3a6ff] uppercase tracking-[0.3em] mb-4">Platform Capabilities</p>
            <h2 className="font-headline font-extrabold text-4xl md:text-5xl tracking-tighter text-balance">
              Everything you need to ship smarter
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="glass-card border border-[#262626] rounded-2xl p-7 flex flex-col gap-4 hover:border-[#a3a6ff]/20 transition-all group"
              >
                <div className="w-11 h-11 rounded-xl bg-[#a3a6ff]/8 border border-[#a3a6ff]/15 flex items-center justify-center group-hover:bg-[#a3a6ff]/15 transition-colors">
                  <span
                    className="material-symbols-outlined text-[#a3a6ff] text-[22px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {feature.icon}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-lg text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-[#adaaaa] leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 px-6 md:px-12 lg:px-24 pb-28">
        <div className="max-w-4xl mx-auto glass-card border border-[#a3a6ff]/15 rounded-3xl p-12 md:p-16 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[#a3a6ff]/3 blur-[80px] rounded-3xl" />
          <div className="relative z-10">
            <h2 className="font-headline font-extrabold text-4xl md:text-5xl tracking-tighter mb-6 text-balance">
              Ready to bridge the void?
            </h2>
            <p className="text-[#adaaaa] text-lg mb-10 text-balance max-w-xl mx-auto">
              Join thousands of businesses that trust Kinetic Void to move what matters most.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
              <Link
                href="/signup"
                className="milled-gradient text-white font-bold text-base px-8 py-4 rounded-full flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all glow-primary"
              >
                <span className="material-symbols-outlined text-[20px]">person_add</span>
                Create Free Account
              </Link>
              <Link
                href="/login"
                className="text-[#adaaaa] hover:text-white font-semibold text-base px-6 py-4 transition-colors"
              >
                Already have an account? Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-[#262626]/60 px-6 md:px-12 lg:px-24 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#a3a6ff] text-base">bolt</span>
            </div>
            <span className="font-headline font-extrabold text-sm tracking-tight text-[#adaaaa]">KINETIC VOID</span>
          </div>
          <nav className="flex items-center gap-6 text-xs font-medium text-[#494847]">
            <Link href="/about" className="hover:text-[#adaaaa] transition-colors">About</Link>
            <Link href="/contact" className="hover:text-[#adaaaa] transition-colors">Contact</Link>
            <Link href="/how-it-works" className="hover:text-[#adaaaa] transition-colors">How It Works</Link>
            <Link href="/fleet" className="hover:text-[#adaaaa] transition-colors">Fleet</Link>
          </nav>
          <p className="text-xs text-[#494847]">
            &copy; {new Date().getFullYear()} Kinetic Void. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
