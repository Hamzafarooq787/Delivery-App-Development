import type { Metadata } from 'next'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'How It Works | Kinetic Void',
  description:
    'Discover the three-phase precision logistics architecture of Kinetic Void — engineered for zero-latency delivery from signal to final handshake.',
}

export default function HowItWorksPage() {
  return (
    <div className="bg-surface font-inter text-on-surface">
      <Header />

      <main className="pt-16 pb-24 md:pb-8 min-h-screen">
        {/* Hero Section */}
        <section className="relative h-[819px] flex items-center justify-center overflow-hidden bg-surface-container-low">
          <div className="absolute inset-0 z-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="w-full h-full object-cover opacity-40"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB-g29a55dZuQD_mtN8IbGXYjpn579HD7D1BLJGU9aM2iUbkElTwh9ZlM28od6d3mbI6H-uMgvTx8lKcBFH3tUOfU39VlzsGhbQlsECBHR2T2I-ueYpNsUQ_MFSA7F_kzSnTbdI6rweXzJzX7Q8kBJMwXoJrc4dNEuUESMkVJmVnw6qEj4QjJkff-ldkAKqJLfcFZravdauuu2-ONfgF_fRxX_bYRgOSUtw9g1YwhQ-U6W4QZLeyzxhETxlnaI64FC7ujkSU1vRiA"
              alt="Abstract deep space aesthetic with glowing digital data streams"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface/80 to-surface"></div>
          </div>
          <div className="relative z-10 text-center px-6 max-w-4xl">
            <h2 className="font-headline text-5xl md:text-7xl font-black text-on-surface tracking-tighter mb-6">
              ENGINEERED FOR <span className="text-primary italic">VELOCITY</span>
            </h2>
            <p className="font-inter text-lg md:text-xl text-on-surface-variant max-w-2xl mx-auto mb-10 leading-relaxed">
              Kinetic Void is a precision logistics architecture designed to eliminate friction between request and fulfillment. Three steps to absolute delivery.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              <button className="bg-primary text-on-primary font-headline font-bold px-8 py-4 rounded-lg flex items-center gap-2 shadow-[0_0_15px_rgba(163,166,255,0.2)] transition-transform active:scale-95">
                INITIALIZE NETWORK <span className="material-symbols-outlined">bolt</span>
              </button>
              <button className="border border-[#494847] text-on-surface hover:bg-surface-container-high font-headline font-bold px-8 py-4 rounded-lg transition-colors">
                VIEW LIVE STATUS
              </button>
            </div>
          </div>
        </section>

        {/* The 3-Step Visualization */}
        <section className="max-w-7xl mx-auto px-6 md:px-12 py-24 space-y-32">
          {/* Step 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="order-2 md:order-1">
              <div className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-inter text-[10px] tracking-[0.2em] uppercase mb-6">
                Phase 01
              </div>
              <h3 className="font-headline text-4xl md:text-5xl font-extrabold text-on-surface mb-6 tracking-tight">The Void Signal</h3>
              <p className="text-on-surface-variant text-lg leading-relaxed mb-8">
                Every journey begins as a digital resonance. Your request is ingested into our core, where it is instantly parsed for destination, density, and urgency. We don&apos;t just record orders; we manifest a delivery path.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary mt-1">sensors</span>
                  <div>
                    <h4 className="text-on-surface font-bold">Encrypted Ingestion</h4>
                    <p className="text-sm text-on-surface-variant">Real-time data parity across all nodes.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary mt-1">analytics</span>
                  <div>
                    <h4 className="text-on-surface font-bold">Predictive Sizing</h4>
                    <p className="text-sm text-on-surface-variant">Automated volume analysis for perfect vehicle matching.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="order-1 md:order-2 relative aspect-square group">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-[100px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative h-full w-full rounded-2xl overflow-hidden border border-[#494847]/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCFQdYxSPPnPfcq4R6JG4kwjwy4vCgLq87C85WFcQE9-tNrHrA5SZ7-ItUQ1o5-7OsHu-ykzo4G7RXS5emGpn6c-FsNhduOwg7N2N5yh1vNXg_9RgP5K6mj2mELDyZC5INuNLitjtXS6PE53_TA6vxfO_pYaN15N2bn1tiX6J7lkdjPCQEqHUjWDbgILQkwkBLBqZmy_hBrqMzy4viHIu7KLK8IcF0wEe9RUxgGixrn93vsanTXBA2f_hzvA-paXLa9zbNMzxoibw"
                  alt="High-tech futuristic glowing circuitry"
                />
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7 relative h-[500px] rounded-2xl overflow-hidden border border-[#494847]/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDPAfiXWKV4bJtD3n2YxPHwzY4iRrq5DAkGafW_bzT6rFtOK70UioglpU_DJuUqLpcBCMrRLz9lInpuxOPM3WDsogoM1W5h3w2Eu5eTB_9zn58x1WWAlsVzzf9x_dFBTkpOwDe-Vv2ESHhq-hwAaGLYnBKCVlGVi6GbZ1-Ji_Y8W5uCgRasn87KLJoregB3Cw5rQ2PMOm6CNjE45g7J_-IUHLoZWLcLz9JSQIECdpmcoI5UnSSoF_nmdCpQIrJqNeiU_mlUh4yftw"
                alt="Abstract visualization of a glowing network map"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-transparent to-transparent"></div>
              <div className="absolute bottom-6 left-6 right-6 glass-card p-6 rounded-xl border border-[#494847]/15">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined">alt_route</span>
                  </div>
                  <div>
                    <p className="text-xs text-secondary font-bold uppercase tracking-widest">Active Routing</p>
                    <p className="text-on-surface font-headline font-medium">Calculating optimal trajectory through the void...</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="md:col-span-5 md:pl-12">
              <div className="inline-block px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-secondary font-inter text-[10px] tracking-[0.2em] uppercase mb-6">
                Phase 02
              </div>
              <h3 className="font-headline text-4xl md:text-5xl font-extrabold text-on-surface mb-6 tracking-tight">Kinetic Routing</h3>
              <p className="text-on-surface-variant text-lg leading-relaxed mb-8">
                The Kinetic engine never sleeps. It processes millions of variables—traffic entropy, atmospheric conditions, and fleet availability—to dispatch the exact resource needed.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-surface-container rounded-lg border border-[#494847]/10">
                  <span className="material-symbols-outlined text-secondary mb-2">speed</span>
                  <p className="text-on-surface text-sm font-bold">Zero-Latency</p>
                  <p className="text-[10px] text-on-surface-variant">Dispatch within 180ms of signal ingest.</p>
                </div>
                <div className="p-4 bg-surface-container rounded-lg border border-[#494847]/10">
                  <span className="material-symbols-outlined text-secondary mb-2">hub</span>
                  <p className="text-on-surface text-sm font-bold">Swarm Intelligence</p>
                  <p className="text-[10px] text-on-surface-variant">Decentralized fleet coordination.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-inter text-[10px] tracking-[0.2em] uppercase mb-6">
                Phase 03
              </div>
              <h3 className="font-headline text-4xl md:text-5xl font-extrabold text-on-surface mb-6 tracking-tight">The Final Handshake</h3>
              <p className="text-on-surface-variant text-lg leading-relaxed mb-8">
                The void closes. Delivery is finalized with biometric precision. Our agents bridge the gap between the digital ether and the physical world with a secure, verified completion protocol.
              </p>
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-surface-container-high rounded-xl border border-[#494847]/15">
                  <div className="h-12 w-12 rounded bg-primary/20 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  </div>
                  <div>
                    <h4 className="text-on-surface font-bold">Biometric Validation</h4>
                    <p className="text-xs text-on-surface-variant">Secure proof of possession for every item.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-surface-container-high rounded-xl border border-[#494847]/15">
                  <div className="h-12 w-12 rounded bg-primary/20 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">receipt_long</span>
                  </div>
                  <div>
                    <h4 className="text-on-surface font-bold">Immutable Ledger</h4>
                    <p className="text-xs text-on-surface-variant">Instant digital confirmation and chain of custody.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDPStyOfoxMusw6DbLdvrDr-wyCYy-QRlnjHi-wVuU7O3ItU9mSNwUPTCsBafIfqH6YPj8VIc74x_zGvK0M948k2R6_qcDYfZzysiXh-BqwsHja2yBvEg43yUcVe9xaUatWkMCpzs7K_1qrCijYX5mmhT3bGRpC9I9uLeBdRxPyiC6XlNnPtHunXM8H8JvooSA83HX37-4mxScjnnddAuZgMXB8iXZFUcVpnsP5Q4RpKwB_XcHVlY_qm88EJgg8H3_FT9UYKI2hdQ"
                alt="Futuristic professional logistics delivery completion"
              />
              <div className="absolute inset-0 bg-primary/10 mix-blend-overlay"></div>
            </div>
          </div>
        </section>

        {/* Core Stack Bento Grid */}
        <section className="py-24 bg-surface-container-low">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="mb-16 text-center">
              <h2 className="font-headline text-3xl md:text-5xl font-black text-on-surface mb-4 tracking-tighter">THE CORE STACK</h2>
              <p className="text-on-surface-variant uppercase tracking-[0.3em] text-xs">Proprietary Logistics Technologies</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:h-[600px]">
              {/* Large Card */}
              <div className="md:col-span-2 md:row-span-2 bg-surface-container p-10 rounded-2xl border border-[#494847]/15 relative overflow-hidden flex flex-col justify-end group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale group-hover:scale-105 transition-transform duration-700"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDxY2pI22h6pQ7i3zo3HXqoO9Bt4fxlWH9ph1vJFdsoCHQ6MxvLk5dP_7sFCgpalfHrV5xVE2g0shX8yS3nycQMUBBGOKbh-T2hrRWzxgvVgu9DuDha7pb33I33nP8vBvXqnNlKwBHK_42j1V5wIRSUK8OnvTM71ubJss_VEE_RPK-JP9Xjvr6hOD0L1gmDs_w65KdBDpbOQI_703PUui-B9qDWR3pXnCV7s5Fw31xhEG97mSS8-yANQsi5H6I9_nisH5K3CNqdqw"
                  alt="Data visualization dashboard"
                />
                <div className="relative z-10">
                  <span className="material-symbols-outlined text-primary text-4xl mb-4">monitoring</span>
                  <h4 className="text-2xl font-headline font-bold text-on-surface mb-2">Void Analytics Hub</h4>
                  <p className="text-on-surface-variant text-sm max-w-xs">Gain absolute visibility over your supply chain with real-time telemetry and deep-learning forecasts.</p>
                </div>
              </div>
              {/* Wide Card */}
              <div className="md:col-span-2 bg-surface-container-high p-8 rounded-2xl border border-[#494847]/15 flex items-center justify-between group hover:bg-surface-container-highest transition-colors">
                <div className="flex-1">
                  <h4 className="text-xl font-headline font-bold text-on-surface mb-1">Fleet Sync</h4>
                  <p className="text-on-surface-variant text-xs">Proprietary vehicle-to-vehicle communication network.</p>
                </div>
                <span className="material-symbols-outlined text-secondary text-5xl opacity-50 group-hover:opacity-100 transition-opacity">wifi_tethering</span>
              </div>
              {/* Square Card 1 */}
              <div className="bg-surface-container p-6 rounded-2xl border border-[#494847]/15 flex flex-col items-center text-center justify-center space-y-3 group">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined">security</span>
                </div>
                <h4 className="font-bold text-sm">Quantum Sec</h4>
                <p className="text-[10px] text-on-surface-variant">Military-grade encryption for all manifests.</p>
              </div>
              {/* Square Card 2 */}
              <div className="bg-surface-container p-6 rounded-2xl border border-[#494847]/15 flex flex-col items-center text-center justify-center space-y-3 group">
                <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined">auto_mode</span>
                </div>
                <h4 className="font-bold text-sm">Auto-Scale</h4>
                <p className="text-[10px] text-on-surface-variant">Instant bandwidth expansion during peak traffic.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 px-6 text-center">
          <h2 className="font-headline text-4xl md:text-6xl font-black mb-8 tracking-tighter">
            READY TO <span className="text-primary">ENTER THE VOID?</span>
          </h2>
          <p className="text-on-surface-variant text-lg max-w-xl mx-auto mb-12">
            Join the global leaders who trust Kinetic Void for their most critical logistics missions.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <button className="bg-primary text-on-primary font-bold px-10 py-5 rounded-lg shadow-[0_0_15px_rgba(163,166,255,0.2)] uppercase tracking-widest text-sm transition-all hover:px-12">
              Request Onboarding
            </button>
          </div>
        </section>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 w-full z-50 h-16 rounded-t-2xl bg-[#0e0e0e]/95 backdrop-blur-md border-t border-[#494847]/20 flex justify-around items-center px-4">
        <div className="flex flex-col items-center gap-1 text-[#adaaaa] p-2">
          <span className="material-symbols-outlined text-lg">grid_view</span>
          <span className="text-[10px] uppercase tracking-widest font-bold">Home</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-[#adaaaa] p-2">
          <span className="material-symbols-outlined text-lg">package_2</span>
          <span className="text-[10px] uppercase tracking-widest font-bold">Logistics</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-[#a3a6ff] drop-shadow-[0_0_8px_rgba(163,166,255,0.4)] p-2">
          <span className="material-symbols-outlined text-lg">route</span>
          <span className="text-[10px] uppercase tracking-widest font-bold">How It Works</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-[#adaaaa] p-2">
          <span className="material-symbols-outlined text-lg">person</span>
          <span className="text-[10px] uppercase tracking-widest font-bold">Profile</span>
        </div>
      </div>

      <Footer />
    </div>
  )
}
