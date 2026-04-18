import type { Metadata } from 'next'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'Safety & Prohibited Items | Kinetic Void',
  description:
    'Understand the Kinetic Void safety protocols and prohibited items guide to ensure your cargo moves safely through our high-speed logistics network.',
}

const prohibitedItems = [
  {
    icon: 'fire_hydrant',
    title: 'Hazardous Materials',
    description: 'Explosives, flammable gases, and oxidizing substances that pose a kinetic threat to fleet stability.',
    items: ['Aerosols & Gas Cylinders', 'Fireworks & Flares'],
  },
  {
    icon: 'medical_services',
    title: 'Bio-Hazardous',
    description: 'Infectious substances, medical waste, or untreated biological agents requiring specialized containment.',
    items: ['Laboratory Cultures', 'Unregulated Specimen'],
  },
  {
    icon: 'warning',
    title: 'Toxic Substances',
    description: "Corrosives, poisons, and radioactive materials that could compromise the Void's environment.",
    items: ['Sulfuric Acids', 'Mercury Compounds'],
  },
  {
    icon: 'inventory_2',
    title: 'Illegal Contraband',
    description: 'Items prohibited by international law, including narcotics and unlicensed tactical equipment.',
    items: ['Counterfeit Goods', 'Restricted Munitions'],
  },
]

const protocols = [
  {
    title: 'Molecular Scanning Thresholds',
    description:
      'Every item entering the Kinetic hub undergoes multi-spectrum molecular analysis to detect trace amounts of forbidden chemical compounds with nanogram sensitivity.',
  },
  {
    title: 'Emergency Quarantine Actions',
    description:
      'If a prohibited item is detected, our automated quarantine system isolates the container within 0.4 seconds, venting the chamber and locking down the hub segment.',
  },
  {
    title: 'Global Customs Integration',
    description:
      'Our proprietary API connects directly with 180+ national customs databases, automating clearance for restricted cargo types that meet specific permit criteria.',
  },
  {
    title: 'Sender Liability Agreement',
    description:
      'By initiating transport, the sender acknowledges full legal responsibility for prohibited cargo attempts. Breach of protocol results in immediate account suspension and legal referral.',
  },
]

export default function SafetyPage() {
  return (
    <div className="bg-surface font-inter text-on-surface">
      <Header />

      <main className="pt-20">
        {/* Hero Section */}
        <section className="relative min-h-[70vh] flex items-center pt-32 pb-24 px-8 md:px-12 overflow-hidden">
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-transparent blur-3xl"></div>
          </div>
          <div className="max-w-screen-2xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10">
            <div className="lg:col-span-8">
              <span className="text-primary font-bold tracking-[0.3em] text-xs mb-6 block uppercase">
                Safety &amp; Compliance Hub
              </span>
              <h1 className="text-6xl md:text-8xl lg:text-[10rem] font-extrabold tracking-tighter mb-10 leading-[0.85] font-headline">
                Prohibited <br />
                <span className="text-on-surface-variant/20">Protocols.</span>
              </h1>
              <p className="text-xl md:text-2xl text-on-surface-variant max-w-3xl leading-relaxed font-medium">
                Maintaining the integrity of our high-speed network requires absolute adherence to security standards. Explore our prohibited items guide to ensure your cargo moves safely through the Kinetic Void.
              </p>
            </div>
            <div className="lg:col-span-4">
              <div className="glass-card p-10 border-l-4 border-l-primary">
                <div className="text-primary mb-6">
                  <span className="material-symbols-outlined text-5xl">verified_user</span>
                </div>
                <h3 className="text-2xl font-bold mb-4 font-headline">Zero-Variance Policy</h3>
                <p className="text-on-surface-variant leading-relaxed">
                  We strictly enforce global logistics safety standards to protect our fleet and your business continuity. Every shipment is vetted by the Kinetic Shielding protocol.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Mission Statement */}
        <section className="px-8 md:px-12 py-24">
          <div className="max-w-screen-2xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 relative overflow-hidden rounded-xl h-[500px] bg-surface-container p-12 flex flex-col justify-end group">
                <div className="absolute inset-0 opacity-50 group-hover:scale-105 transition-transform duration-1000">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="w-full h-full object-cover grayscale"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAU12HVSStqc6EOzNgPIwMBDWtxdUo84EfCvBE3kNXuLFC06_99QdQsoQimqXbL1Vl27_d_3nlNZ3gx2uaH6oCyll9BAAKCpxOoAW-ZOiFUpXZr83bMy0ZxfkXRXOdUqWuxVqJFd4E1b8CZNaSeti295NltG4PucGEqQftbQ2k69AjeYzBb0sqXfC7O79B19sN9polmAPon5PzZRmnxa8YfHE1sfLpdrs-neAup9fWPF2bXKgrTj1q0Hh4MD7gYFpZyI4K675oI3g"
                    alt="High-tech logistics warehouse"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent"></div>
                </div>
                <div className="relative z-10">
                  <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight font-headline">&quot;Safety First&quot; Mission</h2>
                  <p className="text-xl text-on-surface-variant max-w-xl font-medium">
                    Our protocol isn&apos;t just a manual—it&apos;s a commitment to the precision of every delivery. Every item screened, every route optimized, every risk neutralized.
                  </p>
                </div>
              </div>
              <div className="bg-primary rounded-xl flex flex-col justify-between p-12 text-on-primary group cursor-pointer overflow-hidden relative shadow-2xl shadow-primary/20">
                <div className="absolute -right-16 -top-16 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                  <span className="material-symbols-outlined text-[240px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    security
                  </span>
                </div>
                <span className="material-symbols-outlined text-6xl">shield</span>
                <div>
                  <h3 className="text-3xl font-black mb-6 tracking-tight font-headline">Kinetic Shielding</h3>
                  <p className="text-on-primary/90 text-lg font-medium leading-relaxed">
                    Advanced molecular scanning and automated threat detection integrated into every hub infrastructure.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Prohibited Items Grid */}
        <section className="px-8 md:px-12 py-32 max-w-screen-2xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
            <div className="max-w-2xl">
              <span className="text-primary font-bold tracking-[0.2em] text-xs mb-4 block uppercase">Compliance Categories</span>
              <h2 className="text-5xl md:text-6xl font-bold tracking-tight font-headline">Strict Cargo Controls</h2>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-high rounded-full border border-white/5">
                <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse"></span>
                <span className="text-[10px] font-black tracking-widest uppercase">Strictly Forbidden</span>
              </div>
              <div className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-high rounded-full border border-white/5">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                <span className="text-[10px] font-black tracking-widest uppercase">Restricted Flow</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {prohibitedItems.map((item) => (
              <div
                key={item.title}
                className="glass-card p-10 hover:bg-surface-container-low transition-all duration-500 group flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-error text-3xl">{item.icon}</span>
                </div>
                <h4 className="text-2xl font-bold mb-4 font-headline">{item.title}</h4>
                <p className="text-on-surface-variant leading-relaxed text-sm mb-8">{item.description}</p>
                <ul className="w-full space-y-3 pt-6 border-t border-white/5">
                  {item.items.map((sub) => (
                    <li key={sub} className="text-xs font-semibold tracking-wide text-on-surface-variant/60 uppercase">
                      {sub}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Compliance Check */}
        <section className="px-8 md:px-12 py-32">
          <div className="max-w-screen-2xl mx-auto glass-card rounded-2xl p-12 md:p-24 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full md:w-1/2 h-full opacity-20 pointer-events-none">
              <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent"></div>
            </div>
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
              <div>
                <h2 className="text-4xl md:text-5xl font-bold mb-8 tracking-tight font-headline">Need a compliance check?</h2>
                <p className="text-on-surface-variant mb-12 text-xl leading-relaxed">
                  Unsure if your cargo meets Kinetic standards? Our AI-driven compliance engine can analyze your manifest in real-time, providing immediate feedback on transportability.
                </p>
                <div className="flex flex-wrap gap-6">
                  <button className="px-10 py-5 bg-primary text-on-primary font-bold rounded-full hover:bg-primary-fixed transition-all active:scale-95 shadow-lg shadow-primary/20">
                    Consult Expert
                  </button>
                  <button className="px-10 py-5 border border-white/10 text-on-surface font-bold rounded-full hover:bg-surface-container-highest transition-all active:scale-95">
                    Download PDF Guide
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                {[
                  { stat: '99.9%', label: 'Scanning Precision' },
                  { stat: '24/7', label: 'Security Ops' },
                  { stat: '180+', label: 'Global Regions' },
                  { stat: 'ZERO', label: 'Safety Breaches' },
                ].map(({ stat, label }) => (
                  <div
                    key={label}
                    className="p-8 bg-surface-container/50 backdrop-blur-sm rounded-xl border border-white/5 flex flex-col items-center text-center"
                  >
                    <span className="text-4xl font-black text-primary mb-3">{stat}</span>
                    <span className="text-[10px] tracking-widest text-on-surface-variant uppercase font-black">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Operational Protocols */}
        <section className="px-8 md:px-12 py-32 max-w-screen-2xl mx-auto">
          <div className="text-center mb-24">
            <span className="text-primary font-bold tracking-[0.2em] text-xs mb-4 block uppercase">The Operational Standard</span>
            <h2 className="text-5xl md:text-6xl font-bold tracking-tight font-headline">Security Protocols</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-16">
            {protocols.map((protocol) => (
              <div
                key={protocol.title}
                className="group border-b border-white/10 pb-12 hover:border-primary transition-all duration-500"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold font-headline">{protocol.title}</h3>
                  <span className="material-symbols-outlined text-primary group-hover:rotate-90 transition-transform duration-500">add</span>
                </div>
                <p className="text-on-surface-variant leading-relaxed text-lg">{protocol.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
