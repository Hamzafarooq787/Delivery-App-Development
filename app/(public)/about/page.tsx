import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "About Us | Go Drop",
  description: "Filling the void of global inefficiency. Go Drop re-engineers the world's logistical backbone through autonomous coordination and hyper-predictive analytics.",
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      {/* Hero Section */}
      <section className="relative min-h-[70vh] w-full flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="w-full h-full object-cover grayscale opacity-40"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAM_lVE4nkV8cerifRH__12c_48VhA2ytu0SAjlDo38VEwv1FRlRrQStOh3jcWl8SvGgb4UgA_zkIm5cChTvSWMOmxLjedjjrOLJfojpzylOkn5Zt0n5y6GoPBYUX4yfLPkvYltj9YsSJ0AKRqrfrUE6c1ouA4ZdIUZFS-qJJHyPjum7zS1MV5SExTR2YupSyIbKDMT_1yA6646cXGh-P48rcCIvgPV8McYPajZBv820RJWP3ACnE3rkrn4Zfysz_NUzE7a9ev5Nw"
            alt="Go Drop logistics"
          />
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e0e0e] via-[#0e0e0e]/70 to-transparent" />
        </div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-28 sm:py-36">
          <div className="w-full max-w-4xl">
            <span className="text-[#a3a6ff] font-headline font-bold tracking-widest text-xs uppercase mb-4 block">Our Mission</span>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black font-headline text-white leading-tight tracking-tighter mb-6 sm:mb-8 text-balance break-words">
              Filling the{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a3a6ff] to-[#c180ff]">Void</span>{" "}
              of Global Inefficiency.
            </h1>
            <p className="text-[#adaaaa] text-base sm:text-lg md:text-xl max-w-2xl font-light leading-relaxed">
              Go Drop was born from a singular obsession: that movement should be invisible. We are re-engineering the world&apos;s logistical backbone through autonomous coordination and hyper-predictive analytics.
            </p>
            <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              <Link href="/how-it-works" className="w-full sm:w-auto text-center bg-[#a3a6ff] text-[#0f00a4] font-headline font-bold px-10 py-5 rounded-xl shadow-[0_0_20px_rgba(163,166,255,0.3)] hover:scale-105 transition-transform">
                Explore Our Tech
              </Link>
              <Link href="/contact" className="w-full sm:w-auto text-center bg-[#262626]/40 backdrop-blur-md border border-[#494847]/30 text-white px-10 py-5 rounded-xl hover:bg-[#262626] transition-colors">
                Read Manifesto
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid: Core Values */}
      <section className="px-4 sm:px-8 md:px-16 py-16 sm:py-32 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Large Feature */}
          <div className="md:col-span-8 bg-[#1a1919] rounded-3xl p-7 sm:p-10 flex flex-col justify-between border border-[#494847]/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity text-[120px] leading-none">⚡</div>
            <div>
              <h3 className="text-3xl font-headline font-bold text-white mb-4">Zero-Latency Logistics</h3>
              <p className="text-[#adaaaa] max-w-lg leading-relaxed text-lg">
                We don&apos;t just track shipments; we anticipate them. Our proprietary Kinetic Engine simulates millions of route variables in milliseconds, ensuring the void between point A and B is crossed with absolute precision.
              </p>
            </div>
            <div className="mt-12 flex items-center gap-2 text-[#a3a6ff] font-bold cursor-pointer hover:gap-4 transition-all">
              View Technical Specs →
            </div>
          </div>

          {/* Small Callout */}
          <div className="md:col-span-4 bg-gradient-to-br from-[#6f00be]/20 to-[#1a1919] rounded-3xl p-10 border border-[#c180ff]/10 flex flex-col items-center text-center justify-center">
            <div className="w-16 h-16 bg-[#c180ff]/10 rounded-2xl flex items-center justify-center mb-6 text-3xl">🕸️</div>
            <h3 className="text-xl font-headline font-bold text-white mb-2">Neural Network</h3>
            <p className="text-[#adaaaa] text-sm">A global mesh of smart nodes reacting in real-time to global events.</p>
          </div>

          {/* Three Small Columns */}
          {[
            { icon: "👁️", title: "Total Transparency", desc: "Every gram, every millisecond, accounted for in real-time telemetry." },
            { icon: "🌿", title: "Carbon Neutral Path", desc: "Optimizing routes not just for speed, but for minimal planetary impact." },
            { icon: "🔒", title: "Absolute Security", desc: "Blockchain-verified chain of custody for high-stakes cargo." },
          ].map((item) => (
            <div key={item.title} className="md:col-span-4 bg-[#1a1919] rounded-3xl p-8 border border-[#494847]/5">
              <span className="text-[#a3a6ff] text-2xl mb-4 block">{item.icon}</span>
              <h4 className="font-bold text-lg mb-2">{item.title}</h4>
              <p className="text-[#adaaaa] text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Global Impact Stats */}
      <section className="bg-[#131313]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-16 sm:py-32 flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
          <div className="lg:w-1/2 w-full">
            <h2 className="text-4xl sm:text-5xl font-headline font-black mb-8 sm:mb-12 tracking-tighter text-balance">
              The Global <span className="text-[#a3a6ff]">Pulse</span>
            </h2>
            <div className="space-y-12">
              {[
                { num: "01", stat: "42 Countries", sub: "Active deployment of Kinetic infrastructure across all major shipping corridors." },
                { num: "02", stat: "1.2M Daily Units", sub: "Seamlessly transitioned through our autonomous hubs with zero human friction." },
                { num: "03", stat: "99.9% Uptime", sub: "The Go Drop never sleeps, ensuring global trade remains uninterrupted." },
              ].map((item) => (
                <div key={item.num} className="flex items-start gap-4 sm:gap-6 group">
                  <div className="text-4xl sm:text-5xl font-black font-headline text-[#a3a6ff]/40 group-hover:text-[#a3a6ff] transition-colors">{item.num}</div>
                  <div>
                    <h4 className="text-3xl sm:text-4xl font-black text-white">{item.stat}</h4>
                    <p className="text-[#adaaaa] mt-2 max-w-sm">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:w-1/2 w-full h-[380px] sm:h-[550px] bg-[#1a1919] rounded-[2.5rem] border border-[#494847]/10 relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="w-full h-full object-cover opacity-60"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBvltAxy9E_7GYjQlDO57TVH9LtmFPpRkwakAS-BfijZJEz2n0ZcyRvKp12b8z1IADcZXYSdn9mOE7GfWvBkJuxgu-pjvFuhKBia3KSlGmS-Fj95eRc-hXbC-dQEE9l-QExW35GCOJWkJPxUKbpA4EYnUkw3QQ1LhKxUVut6KfBehYIbJdHgwaqM4C2sYbJCEECeXWcT86gYFUJQsDwNOmO-_p5AOC59Rxi8qms0F2We8BYlWJ19cqr06iHLgVlRiSu0FJQUuE0lw"
              alt="Global logistics network"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1919] via-transparent to-transparent" />
            <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
              <div className="glass-card px-6 py-4 rounded-2xl border border-[#494847]/20">
                <p className="text-[10px] text-[#a3a6ff] font-bold uppercase tracking-widest mb-1">Live Feed</p>
                <p className="text-sm font-medium">Oceanic Corridor: Normal</p>
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-[#0e0e0e] bg-[#a3a6ff]/20 flex items-center justify-center text-[10px] font-bold">+12</div>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-16 sm:py-32">
        <div className="text-center mb-12 sm:mb-20">
          <h2 className="text-4xl sm:text-5xl font-headline font-black mb-4 sm:mb-6 tracking-tighter text-balance">The Architects of Void</h2>
          <p className="text-[#adaaaa] text-base sm:text-lg max-w-2xl mx-auto">Engineering the future requires a synthesis of disparate minds. Meet the leadership defining the next era of transit.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { name: "Marcus Chen", role: "Systemic Architect", badge: "Founder / CEO", badgeColor: "[#a3a6ff]", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDIfAzYvu9Uyrtj8JtXcycgN8OR4SXBuQ_em6xcmjpOP-TPCTsCvGuOHQWsziPlnku9maoty_803tH20-XLoS8T99u8Us_vuZ8SSqnVLPma5InG0Fo1DTDoXO5YgEGbleH_HM9PveWaQ699UJHetZx6FAo_Dac37ue2fV0dLuLGjtslfOKjpdxCCIuBHi06_aTUh_nR7BhtL1cmWBd2QiM2uO12S_0fJYTAExR9S753fH5w3HvO3s1Mq7Rp3qOcBTc3Jm7gnZRp8w" },
            { name: "Elena Rodriguez", role: "Neural Specialist", badge: "Head of AI", badgeColor: "[#c180ff]", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuATyUTb-_ECzj49mPJAlE_TkKse2p1IPrnofe3ETp1pUY_S0oIhDy8PQkXkHB-SnOKzU_J0PeKtPO5IctinFV0paLVwfyM7GBcXphBbJmyFq975L2iFK8vIRc6tUcu_R2BVmgFBDFxdzVfWDTg7GonI-n8F4Meq_auZyLHGaffXsENbIJHnAhtoMv1mafOBr52nLi8vyOSnRfWsEKow6txDTKOKp1pP8Cl7_HSajoMyETE9BAy1mECJ_k1jZKRdYO3bbYFV2bIs7w" },
            { name: "David Park", role: "Global Strategist", badge: "Operations", badgeColor: "[#a3a6ff]", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBkLdjwjRs6l9seAbKZBCszxcM3lzAJr036Ewys95jksH8mFc7IlvlyV9cySmpci1Uem87jHgPdqpXO_Dfb8O2vKkZwhFBeIKzTIL_AlSM0MpB9Rxwxw8CZCVxOTgqqEkezcB6ZV_vAoPWPrBaFF1YKy0agPdLZz13KxhhFAo3usDMhwIyQS37BUIWTV7mVq3jTOzFrkD1nHmKaGw_dEvtroPnADy_57njxQpHwPHO6ajCjlS65MCQ0dI79gcFoW8nHfpuWHnLT6A" },
            { name: "Sarah Jenkins", role: "Interface Pioneer", badge: "Product Design", badgeColor: "[#ffa5d9]", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDQYh-2ccFRglo3CMG2zTok8QbHNmORmZg70O0tMRO_HFdKRgR0sOBduKcBVZ3C3jh2i5ahik7taggxrodIoMjYJ40fSZDpkbxV9i4ZGb0xt2iCqd7N_JMzZpJ3iCGtARY77-ANQFb6Ou8aWW9BXjkaXRH3WVFTSZz3NTrn-ZFRjbPYo-uBU6_hi4GX7JtmSw44goX-8tGjX0XCTrzObxsDC-_pAGAQeoJbALmaWUf3iRzUYvfQC8ClwDzBt791SQs--TfT6jHaPA" },
          ].map((member) => (
            <div key={member.name} className="group">
              <div className="relative aspect-[3/4] rounded-3xl overflow-hidden mb-6 border border-[#494847]/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105"
                  src={member.img}
                  alt={member.name}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-transparent to-transparent opacity-60" />
                <div className="absolute bottom-4 left-4">
                  <span className={`bg-${member.badgeColor}/20 backdrop-blur-md text-${member.badgeColor} text-[10px] px-3 py-1 rounded-full font-bold uppercase`}>
                    {member.badge}
                  </span>
                </div>
              </div>
              <h5 className="text-xl font-bold font-headline">{member.name}</h5>
              <p className="text-[#adaaaa] text-sm">{member.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-8 md:px-16 py-20 sm:py-32 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#a3a6ff]/5 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-headline font-black mb-6 sm:mb-8 tracking-tighter text-balance">
            Ready to Enter the <span className="text-[#a3a6ff]">Void?</span>
          </h2>
          <p className="text-[#adaaaa] text-lg mb-10 leading-relaxed">
            Join the global leaders who trust Go Drop for their most critical logistics missions.
          </p>
          <Link href="/signup" className="inline-block bg-[#a3a6ff] text-[#0f00a4] font-bold px-10 py-5 rounded-xl shadow-[0_10px_30px_rgba(163,166,255,0.2)] hover:shadow-[0_15px_40px_rgba(163,166,255,0.3)] hover:scale-[1.01] active:scale-95 transition-all uppercase tracking-[0.1em]">
            Get Started Today
          </Link>
        </div>
      </section>
    </div>
  )
}
