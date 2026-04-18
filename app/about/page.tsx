import type { Metadata } from 'next'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'About Us | Kinetic Void',
  description:
    'Meet the architects of Kinetic Void — a team obsessed with making global movement invisible through autonomous coordination and hyper-predictive analytics.',
}

const teamMembers = [
  {
    name: 'Marcus Chen',
    role: 'Systemic Architect',
    badge: 'Founder / CEO',
    badgeColor: 'bg-primary/20 text-primary',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDIfAzYvu9Uyrtj8JtXcycgN8OR4SXBuQ_em6xcmjpOP-TPCTsCvGuOHQWsziPlnku9maoty_803tH20-XLoS8T99u8Us_vuZ8SSqnVLPma5InG0Fo1DTDoXO5YgEGbleH_HM9PveWaQ699UJHetZx6FAo_Dac37ue2fV0dLuLGjtslfOKjpdxCCIuBHi06_aTUh_nR7BhtL1cmWBd2QiM2uO12S_0fJYTAExR9S753fH5w3HvO3s1Mq7Rp3qOcBTc3Jm7gnZRp8w',
  },
  {
    name: 'Elena Rodriguez',
    role: 'Neural Specialist',
    badge: 'Head of AI',
    badgeColor: 'bg-secondary/20 text-secondary',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuATyUTb-_ECzj49mPJAlE_TkKse2p1IPrnofe3ETp1pUY_S0oIhDy8PQkXkHB-SnOKzU_J0PeKtPO5IctinFV0paLVwfyM7GBcXphBbJmyFq975L2iFK8vIRc6tUcu_R2BVmgFBDFxdzVfWDTg7GonI-n8F4Meq_auZyLHGaffXsENbIJHnAhtoMv1mafOBr52nLi8vyOSnRfWsEKow6txDTKOKp1pP8Cl7_HSajoMyETE9BAy1mECJ_k1jZKRdYO3bbYFV2bIs7w',
  },
  {
    name: 'David Park',
    role: 'Global Strategist',
    badge: 'Operations',
    badgeColor: 'bg-primary/20 text-primary',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBkLdjwjRs6l9seAbKZBCszxcM3lzAJr036Ewys95jksH8mFc7IlvlyV9cySmpci1Uem87jHgPdqpXO_Dfb8O2vKkZwhFBeIKzTIL_AlSM0MpB9Rxwxw8CZCVxOTgqqEkezcB6ZV_vAoPWPrBaFF1YKy0agPdLZz13KxhhFAo3usDMhwIyQS37BUIWTV7mVq3jTOzFrkD1nHmKaGw_dEvtroPnADy_57njxQpHwPHO6ajCjlS65MCQ0dI79gcFoW8nHfpuWHnLT6A',
  },
  {
    name: 'Sarah Jenkins',
    role: 'Interface Pioneer',
    badge: 'Product Design',
    badgeColor: 'bg-tertiary/20 text-tertiary',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDQYh-2ccFRglo3CMG2zTok8QbHNmORmZg70O0tMRO_HFdKRgR0sOBduKcBVZ3C3jh2i5ahik7taggxrodIoMjYJ40fSZDpkbxV9i4ZGb0xt2iCqd7N_JMzZpJ3iCGtARY77-ANQFb6Ou8aWW9BXjkaXRH3WVFTSZz3NTrn-ZFRjbPYo-uBU6_hi4GX7JtmSw44goX-8tGjX0XCTrzObxsDC-_pAGAQeoJbALmaWUf3iRzUYvfQC8ClwDzBt791SQs--TfT6jHaPA',
  },
]

export default function AboutPage() {
  return (
    <div className="bg-surface-container-low font-inter text-on-surface">
      <Header />

      <main className="pt-16 min-h-screen">
        {/* Hero Section */}
        <section className="relative h-[80vh] min-h-[600px] flex items-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/60 to-transparent z-10"></div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="w-full h-full object-cover grayscale opacity-40"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAM_lVE4nkV8cerifRH__12c_48VhA2ytu0SAjlDo38VEwv1FRlRrQStOh3jcWl8SvGgb4UgA_zkIm5cChTvSWMOmxLjedjjrOLJfojpzylOkn5Zt0n5y6GoPBYUX4yfLPkvYltj9YsSJ0AKRqrfrUE6c1ouA4ZdIUZFS-qJJHyPjum7zS1MV5SExTR2YupSyIbKDMT_1yA6646cXGh-P48rcCIvgPV8McYPajZBv820RJWP3ACnE3rkrn4Zfysz_NUzE7a9ev5Nw"
              alt="Automated logistics warehouse"
            />
          </div>
          <div className="relative z-20 px-8 md:px-16 max-w-7xl mx-auto w-full">
            <div className="max-w-4xl">
              <span className="text-primary font-headline font-bold tracking-widest text-xs uppercase mb-4 block">Our Mission</span>
              <h2 className="text-5xl md:text-8xl font-black font-headline text-on-surface leading-[0.9] tracking-tighter mb-8">
                Filling the{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Void</span> of Global
                Inefficiency.
              </h2>
              <p className="text-on-surface-variant text-lg md:text-2xl max-w-2xl font-light leading-relaxed">
                Kinetic Void was born from a singular obsession: that movement should be invisible. We are re-engineering the
                world&apos;s logistical backbone through autonomous coordination and hyper-predictive analytics.
              </p>
              <div className="mt-12 flex flex-wrap gap-4">
                <button className="bg-primary text-on-primary font-headline font-bold px-10 py-5 rounded-xl shadow-[0_0_20px_rgba(163,166,255,0.3)] hover:scale-105 transition-transform">
                  Explore Our Tech
                </button>
                <button className="bg-surface-container-highest/40 backdrop-blur-md border border-[#494847]/30 text-on-surface px-10 py-5 rounded-xl hover:bg-surface-container-highest transition-colors">
                  Read Manifesto
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Bento Grid Core Values */}
        <section className="px-8 md:px-16 py-32 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Large Feature */}
            <div className="md:col-span-8 bg-surface-container rounded-3xl p-10 flex flex-col justify-between border border-[#494847]/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-[120px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  speed
                </span>
              </div>
              <div>
                <h3 className="text-3xl font-headline font-bold text-on-surface mb-4">Zero-Latency Logistics</h3>
                <p className="text-on-surface-variant max-w-lg leading-relaxed text-lg">
                  We don&apos;t just track shipments; we anticipate them. Our proprietary Kinetic Engine simulates millions of route
                  variables in milliseconds, ensuring the void between point A and B is crossed with absolute precision.
                </p>
              </div>
              <div className="mt-12 flex items-center gap-2 text-primary font-bold cursor-pointer hover:gap-4 transition-all">
                View Technical Specs <span className="material-symbols-outlined">arrow_forward</span>
              </div>
            </div>
            {/* Small Callout */}
            <div className="md:col-span-4 bg-gradient-to-br from-secondary-container/20 to-surface-container rounded-3xl p-10 border border-secondary/10 flex flex-col items-center text-center justify-center">
              <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-secondary text-3xl">hub</span>
              </div>
              <h3 className="text-xl font-headline font-bold text-on-surface mb-2">Neural Network</h3>
              <p className="text-on-surface-variant text-sm">A global mesh of smart nodes reacting in real-time to global events.</p>
            </div>
            {/* Three Small Columns */}
            <div className="md:col-span-4 bg-surface-container rounded-3xl p-8 border border-[#494847]/5">
              <span className="material-symbols-outlined text-primary mb-4">visibility</span>
              <h4 className="font-bold text-lg mb-2">Total Transparency</h4>
              <p className="text-on-surface-variant text-sm">Every gram, every millisecond, accounted for in real-time telemetry.</p>
            </div>
            <div className="md:col-span-4 bg-surface-container rounded-3xl p-8 border border-[#494847]/5">
              <span className="material-symbols-outlined text-primary mb-4">eco</span>
              <h4 className="font-bold text-lg mb-2">Carbon Neutral Path</h4>
              <p className="text-on-surface-variant text-sm">Optimizing routes not just for speed, but for minimal planetary impact.</p>
            </div>
            <div className="md:col-span-4 bg-surface-container rounded-3xl p-8 border border-[#494847]/5">
              <span className="material-symbols-outlined text-primary mb-4">security</span>
              <h4 className="font-bold text-lg mb-2">Absolute Security</h4>
              <p className="text-on-surface-variant text-sm">Blockchain-verified chain of custody for high-stakes cargo.</p>
            </div>
          </div>
        </section>

        {/* Global Impact Map & Stats */}
        <section className="bg-surface-container-low/50">
          <div className="max-w-7xl mx-auto px-8 md:px-16 py-32 flex flex-col lg:flex-row gap-16 items-center">
            <div className="lg:w-1/2">
              <h2 className="text-5xl font-headline font-black mb-12 tracking-tighter">
                The Global <span className="text-primary">Pulse</span>
              </h2>
              <div className="space-y-12">
                <div className="flex items-start gap-6 group">
                  <div className="text-5xl font-black font-headline text-primary/40 group-hover:text-primary transition-colors">01</div>
                  <div>
                    <h4 className="text-4xl font-black text-on-surface">
                      42 <span className="text-lg font-medium text-on-surface-variant">Countries</span>
                    </h4>
                    <p className="text-on-surface-variant mt-2 max-w-sm">
                      Active deployment of Kinetic infrastructure across all major shipping corridors.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-6 group">
                  <div className="text-5xl font-black font-headline text-primary/40 group-hover:text-primary transition-colors">02</div>
                  <div>
                    <h4 className="text-4xl font-black text-on-surface">
                      1.2M <span className="text-lg font-medium text-on-surface-variant">Daily Units</span>
                    </h4>
                    <p className="text-on-surface-variant mt-2 max-w-sm">
                      Seamlessly transitioned through our autonomous hubs with zero human friction.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-6 group">
                  <div className="text-5xl font-black font-headline text-primary/40 group-hover:text-primary transition-colors">03</div>
                  <div>
                    <h4 className="text-4xl font-black text-on-surface">
                      99.9% <span className="text-lg font-medium text-on-surface-variant">Uptime</span>
                    </h4>
                    <p className="text-on-surface-variant mt-2 max-w-sm">
                      The Kinetic Void never sleeps, ensuring global trade remains uninterrupted.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 w-full h-[550px] bg-surface-container rounded-[2.5rem] border border-[#494847]/10 relative overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-full h-full object-cover opacity-60"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBvltAxy9E_7GYjQlDO57TVH9LtmFPpRkwakAS-BfijZJEz2n0ZcyRvKp12b8z1IADcZXYSdn9mOE7GfWvBkJuxgu-pjvFuhKBia3KSlGmS-Fj95eRc-hXbC-dQEE9l-QExW35GCOJWkJPxUKbpA4EYnUkw3QQ1LhKxUVut6KfBehYIbJdHgwaqM4C2sYbJCEECeXWcT86gYFUJQsDwNOmO-_p5AOC59Rxi8qms0F2We8BYlWJ19cqr06iHLgVlRiSu0FJQUuE0lw"
                alt="Abstract dark world map with glowing neon nodes"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-transparent to-transparent"></div>
              <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
                <div className="glass-card px-6 py-4 rounded-2xl border border-[#494847]/20">
                  <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-1">Live Feed</p>
                  <p className="text-sm font-medium">Oceanic Corridor: Normal</p>
                </div>
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full border-2 border-surface bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                    +12
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="max-w-7xl mx-auto px-8 md:px-16 py-32">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-headline font-black mb-6 tracking-tighter">The Architects of Void</h2>
            <p className="text-on-surface-variant text-lg max-w-2xl mx-auto">
              Engineering the future requires a synthesis of disparate minds. Meet the leadership defining the next era of transit.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {teamMembers.map((member) => (
              <div key={member.name} className="group">
                <div className="relative aspect-[3/4] rounded-3xl overflow-hidden mb-6 border border-[#494847]/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105"
                    src={member.image}
                    alt={member.name}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-60"></div>
                  <div className="absolute bottom-4 left-4">
                    <span className={`${member.badgeColor} backdrop-blur-md text-[10px] px-3 py-1 rounded-full font-bold uppercase`}>
                      {member.badge}
                    </span>
                  </div>
                </div>
                <h5 className="text-xl font-bold font-headline">{member.name}</h5>
                <p className="text-on-surface-variant text-sm">{member.role}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-8 md:px-16 py-48 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 blur-[150px] rounded-full -z-10"></div>
          <div className="max-w-7xl mx-auto">
            <h2 className="text-5xl md:text-8xl font-headline font-black mb-10 max-w-4xl mx-auto tracking-tighter leading-none">
              Ready to inhabit the Void?
            </h2>
            <p className="text-on-surface-variant text-xl md:text-2xl mb-16 max-w-2xl mx-auto font-light">
              Join the 400+ enterprises redefining their operational reality through Kinetic Void.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <button className="bg-on-surface text-surface font-bold px-12 py-6 rounded-2xl hover:scale-105 transition-transform text-lg">
                Request Beta Access
              </button>
              <button className="glass-card border border-[#494847]/20 px-12 py-6 rounded-2xl hover:bg-surface-container-highest transition-colors text-lg">
                Contact Sales
              </button>
            </div>
          </div>
        </section>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 h-16 bg-[#0e0e0e]/95 backdrop-blur-md border-t border-[#494847]/20 flex justify-around items-center px-4">
          <div className="flex flex-col items-center text-[#adaaaa]">
            <span className="material-symbols-outlined text-xl">grid_view</span>
            <span className="text-[10px] uppercase tracking-widest font-bold mt-1">Home</span>
          </div>
          <div className="flex flex-col items-center text-[#adaaaa]">
            <span className="material-symbols-outlined text-xl">package_2</span>
            <span className="text-[10px] uppercase tracking-widest font-bold mt-1">Ship</span>
          </div>
          <div className="flex flex-col items-center text-[#a3a6ff]">
            <span className="material-symbols-outlined text-xl">info</span>
            <span className="text-[10px] uppercase tracking-widest font-bold mt-1">About</span>
          </div>
          <div className="flex flex-col items-center text-[#adaaaa]">
            <span className="material-symbols-outlined text-xl">settings</span>
            <span className="text-[10px] uppercase tracking-widest font-bold mt-1">Set</span>
          </div>
        </nav>
      </main>

      <Footer />
    </div>
  )
}
