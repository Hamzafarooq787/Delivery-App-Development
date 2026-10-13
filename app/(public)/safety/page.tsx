import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Safety & Prohibited Items | Go Drop",
  description: "Maintaining the integrity of our high-speed network requires absolute adherence to security standards.",
}

const prohibitedItems = [
  {
    icon: "local_fire_department",
    title: "Hazardous Materials",
    desc: "Explosives, flammable gases, and oxidizing substances that pose a kinetic threat to fleet stability.",
    examples: ["Aerosols & Gas Cylinders", "Fireworks & Flares"],
    color: "text-[#ff6e84] bg-[#ff6e84]/10",
  },
  {
    icon: "medical_services",
    title: "Bio-Hazardous",
    desc: "Infectious substances, medical waste, or untreated biological agents requiring specialized containment.",
    examples: ["Laboratory Cultures", "Unregulated Specimen"],
    color: "text-[#ff6e84] bg-[#ff6e84]/10",
  },
  {
    icon: "warning",
    title: "Toxic Substances",
    desc: "Corrosives, poisons, and radioactive materials that could compromise the Void's environment.",
    examples: ["Sulfuric Acids", "Mercury Compounds"],
    color: "text-[#ff6e84] bg-[#ff6e84]/10",
  },
  {
    icon: "inventory_2",
    title: "Illegal Contraband",
    desc: "Items prohibited by international law, including narcotics and unlicensed tactical equipment.",
    examples: ["Counterfeit Goods", "Restricted Munitions"],
    color: "text-[#ff6e84] bg-[#ff6e84]/10",
  },
]

const protocols = [
  {
    title: "Molecular Scanning Thresholds",
    desc: "Every item entering the Kinetic hub undergoes multi-spectrum molecular analysis to detect trace amounts of forbidden chemical compounds with nanogram sensitivity.",
  },
  {
    title: "Emergency Quarantine Actions",
    desc: "If a prohibited item is detected, our automated quarantine system isolates the container within 0.4 seconds, venting the chamber and locking down the hub segment.",
  },
  {
    title: "Global Customs Integration",
    desc: "Our proprietary API connects directly with 180+ national customs databases, automating clearance for restricted cargo types that meet specific permit criteria.",
  },
  {
    title: "Sender Liability Agreement",
    desc: "By initiating transport, the sender acknowledges full legal responsibility for prohibited cargo attempts. Breach of protocol results in immediate account suspension and legal referral.",
  },
]

export default function SafetyPage() {
  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      {/* Hero */}
      <section className="relative w-full min-h-[70vh] flex items-center pt-24 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-8 md:px-12 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(var(--brand-rgb),0.3),transparent_60%)] blur-3xl" />
        </div>
        <div className="max-w-screen-2xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center relative z-10">
          <div className="lg:col-span-8">
            <span className="text-[var(--color-primary)] font-bold tracking-[0.3em] text-xs mb-4 sm:mb-6 block uppercase">Safety &amp; Compliance Hub</span>
            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[8rem] font-extrabold font-headline tracking-tighter mb-6 sm:mb-10 leading-tight lg:leading-[0.85] text-balance break-words">
              Prohibited <br />
              <span className="text-white/20">Protocols.</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-[#adaaaa] max-w-3xl leading-relaxed font-medium">
              Maintaining the integrity of our high-speed network requires absolute adherence to security standards. Explore our prohibited items guide to ensure your cargo moves safely through the Go Drop.
            </p>
          </div>
          <div className="lg:col-span-4">
            <div className="bg-[#262626]/40 backdrop-blur-xl border border-white/5 border-l-4 border-l-[var(--color-primary)] p-6 sm:p-8 lg:p-10 rounded-xl">
              <div className="text-[var(--color-primary)] mb-4 sm:mb-6 text-4xl sm:text-5xl leading-none">✦</div>
              <h3 className="text-xl sm:text-2xl font-bold font-headline mb-3 sm:mb-4">Zero-Variance Policy</h3>
              <p className="text-[#adaaaa] leading-relaxed text-sm sm:text-base">We strictly enforce global logistics safety standards to protect our fleet and your business continuity. Every shipment is vetted by the Kinetic Shielding protocol.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="px-4 sm:px-8 md:px-12 py-12 sm:py-16 lg:py-24">
        <div className="max-w-screen-2xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="md:col-span-2 relative overflow-hidden rounded-xl h-[340px] sm:h-[420px] md:h-[500px] bg-[#1a1919] p-7 sm:p-10 lg:p-12 flex flex-col justify-end group">
              <div className="absolute inset-0 opacity-50 group-hover:scale-105 transition-transform duration-1000">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAU12HVSStqc6EOzNgPIwMBDWtxdUo84EfCvBE3kNXuLFC06_99QdQsoQimqXbL1Vl27_d_3nlNZ3gx2uaH6oCyll9BAAKCpxOoAW-ZOiFUpXZr83bMy0ZxfkXRXOdUqWuxVqJFd4E1b8CZNaSeti295NltG4PucGEqQftbQ2k69AjeYzBb0sqXfC7O79B19sN9polmAPon5PzZRmnxa8YfHE1sfLpdrs-neAup9fWPF2bXKgrTj1q0Hh4MD7gYFpZyI4K675oI3g"
                  alt="High-tech logistics warehouse"
                  className="w-full h-full object-cover grayscale"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/40 to-transparent" />
              </div>
              <div className="relative z-10">
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold font-headline mb-4 sm:mb-6 tracking-tight text-balance">&ldquo;Safety First&rdquo; Mission</h2>
                <p className="text-base sm:text-lg lg:text-xl text-[#adaaaa] max-w-xl font-medium">Our protocol isn&apos;t just a manual — it&apos;s a commitment to the precision of every delivery. Every item screened, every route optimized, every risk neutralized.</p>
              </div>
            </div>
            <div className="bg-[var(--color-primary)] rounded-xl flex flex-col justify-between p-7 sm:p-10 lg:p-12 text-[var(--color-on-primary)] relative overflow-hidden shadow-2xl shadow-[var(--color-primary)]/20 min-h-[260px]">
              <div className="absolute -right-16 -top-16 opacity-10 text-[240px] leading-none select-none">✦</div>
              <div className="text-4xl sm:text-5xl lg:text-6xl leading-none">🛡️</div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-black font-headline mb-4 sm:mb-6 tracking-tight">Kinetic Shielding</h3>
                <p className="text-[var(--color-on-primary)]/90 text-base sm:text-lg font-medium leading-relaxed">Advanced molecular scanning and automated threat detection integrated into every hub infrastructure.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Prohibited Items Grid */}
      <section className="px-4 sm:px-8 md:px-12 py-16 sm:py-24 lg:py-32 max-w-screen-2xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 sm:mb-16 lg:mb-20 gap-6 sm:gap-8">
          <div className="max-w-2xl">
            <span className="text-[var(--color-primary)] font-bold tracking-[0.2em] text-xs mb-4 block uppercase">Compliance Categories</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-headline tracking-tight text-balance">Strict Cargo Controls</h2>
          </div>
          <div className="flex flex-wrap gap-3 sm:gap-4">
            <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-[#201f1f] rounded-full border border-white/5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff6e84] animate-pulse shrink-0" />
              <span className="text-[10px] font-black tracking-widest uppercase">Strictly Forbidden</span>
            </div>
            <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-[#201f1f] rounded-full border border-white/5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-secondary)] shrink-0" />
              <span className="text-[10px] font-black tracking-widest uppercase">Restricted Flow</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {prohibitedItems.map((item) => (
            <div key={item.title} className="bg-[#262626]/40 backdrop-blur-xl border border-white/5 p-7 sm:p-8 lg:p-10 hover:bg-[#131313] transition-all duration-500 group flex flex-col items-center text-center rounded-xl">
              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-6 sm:mb-8 group-hover:scale-110 transition-transform ${item.color}`}>
                <span className="text-2xl sm:text-3xl font-bold">✕</span>
              </div>
              <h4 className="text-xl sm:text-2xl font-bold font-headline mb-3 sm:mb-4">{item.title}</h4>
              <p className="text-[#adaaaa] leading-relaxed text-sm mb-6 sm:mb-8">{item.desc}</p>
              <ul className="w-full space-y-3 pt-5 sm:pt-6 border-t border-white/5">
                {item.examples.map((ex) => (
                  <li key={ex} className="text-xs font-semibold tracking-wide text-[#adaaaa]/60 uppercase">{ex}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Compliance CTA */}
      <section className="px-4 sm:px-8 md:px-12 py-16 sm:py-24 lg:py-32">
        <div className="max-w-screen-2xl mx-auto bg-[#262626]/40 backdrop-blur-xl border border-white/5 rounded-2xl p-7 sm:p-12 md:p-16 lg:p-24 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-full md:w-1/2 h-full opacity-20 pointer-events-none">
            <div className="w-full h-full bg-[radial-gradient(circle_at_center,rgba(var(--brand-rgb),1),transparent_60%)]" />
          </div>
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-14 lg:gap-20 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold font-headline mb-5 sm:mb-8 tracking-tight text-balance">Need a compliance check?</h2>
              <p className="text-[#adaaaa] mb-8 sm:mb-12 text-base sm:text-lg lg:text-xl leading-relaxed">Unsure if your cargo meets Kinetic standards? Our AI-driven compliance engine can analyze your manifest in real-time, providing immediate feedback on transportability.</p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 lg:gap-6">
                <button className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold rounded-full hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-[var(--color-primary)]/20">Consult Expert</button>
                <button className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 border border-white/10 text-white font-bold rounded-full hover:bg-[#262626] transition-all active:scale-95">Download PDF Guide</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              {[
                { stat: "99.9%", label: "Scanning Precision" },
                { stat: "24/7", label: "Security Ops" },
                { stat: "180+", label: "Global Regions" },
                { stat: "ZERO", label: "Safety Breaches" },
              ].map((s) => (
                <div key={s.label} className="p-5 sm:p-6 lg:p-8 bg-[#1a1919]/50 backdrop-blur-sm rounded-xl border border-white/5 flex flex-col items-center text-center">
                  <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-[var(--color-primary)] mb-2 sm:mb-3">{s.stat}</span>
                  <span className="text-[10px] tracking-widest text-[#adaaaa] uppercase font-black">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security Protocols */}
      <section className="px-4 sm:px-8 md:px-12 py-16 sm:py-24 lg:py-32 max-w-screen-2xl mx-auto">
        <div className="text-center mb-12 sm:mb-16 lg:mb-24">
          <span className="text-[var(--color-primary)] font-bold tracking-[0.2em] text-xs mb-4 block uppercase">The Operational Standard</span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-headline tracking-tight text-balance">Security Protocols</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 sm:gap-x-12 gap-y-10 sm:gap-y-14 lg:gap-y-16">
          {protocols.map((p) => (
            <div key={p.title} className="group border-b border-white/10 pb-8 sm:pb-10 lg:pb-12 hover:border-[var(--color-primary)] transition-all duration-500">
              <div className="flex items-start justify-between gap-4 mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold font-headline">{p.title}</h3>
                <span className="text-[var(--color-primary)] group-hover:rotate-90 transition-transform duration-500 text-2xl leading-none shrink-0">+</span>
              </div>
              <p className="text-[#adaaaa] leading-relaxed text-sm sm:text-base lg:text-lg">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

