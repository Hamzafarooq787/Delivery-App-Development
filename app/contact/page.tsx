'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default function ContactPage() {
  const [selectedDept, setSelectedDept] = useState('Logistics')
  const departments = ['Logistics', 'Technical', 'Enterprise', 'Security']

  return (
    <div className="bg-surface font-inter text-on-surface">
      <Header />

      <main className="pt-16 min-h-screen relative overflow-hidden">
        {/* Kinetic mesh background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(163, 166, 255, 0.05) 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        ></div>
        {/* Ambient Light */}
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-24 relative z-10">
          <div className="grid lg:grid-cols-12 gap-16 items-start">
            {/* Left: Contact Info */}
            <div className="lg:col-span-5 space-y-12">
              <header className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-primary">Transmission Gateway</span>
                </div>
                <h1 className="text-5xl lg:text-7xl font-headline font-extrabold tracking-tighter text-on-surface leading-[0.9]">
                  Contact <span className="text-primary">HQ</span>
                </h1>
                <p className="text-lg text-on-surface-variant max-w-md font-light leading-relaxed">
                  Global logistics management requires absolute synchronization. Connect with our neural center for immediate support.
                </p>
              </header>

              <div className="space-y-8">
                {/* HQ Address */}
                <div className="group flex gap-6 p-6 rounded-2xl hover:bg-surface-container transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-surface-container-highest border border-[#494847]/15 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined">location_on</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Global Headquarters</p>
                    <p className="text-on-surface text-lg font-medium">
                      Kinetic Plaza, Level 42<br />Sector 9, Neo-Silicon Valley
                    </p>
                  </div>
                </div>
                {/* Email */}
                <div className="group flex gap-6 p-6 rounded-2xl hover:bg-surface-container transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-surface-container-highest border border-[#494847]/15 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined">alternate_email</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Electronic Correspondence</p>
                    <p className="text-on-surface text-lg font-medium">hq@kineticvoid.io</p>
                    <p className="text-on-surface-variant text-sm">support-ops@kineticvoid.io</p>
                  </div>
                </div>
                {/* Support */}
                <div className="group flex gap-6 p-6 rounded-2xl hover:bg-surface-container transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-surface-container-highest border border-[#494847]/15 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined">hub</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Neural Support Hub</p>
                    <p className="text-on-surface text-lg font-medium">+1 (800) KINETIC-V</p>
                    <p className="text-on-surface-variant text-sm">24/7 Global Fleet Response</p>
                  </div>
                </div>
              </div>

              <div className="pt-8 flex items-center gap-6 opacity-50">
                <div className="h-[1px] flex-1 bg-[#494847]"></div>
                <div className="flex gap-4">
                  <span className="material-symbols-outlined cursor-pointer hover:text-primary transition-colors">public</span>
                  <span className="material-symbols-outlined cursor-pointer hover:text-primary transition-colors">terminal</span>
                  <span className="material-symbols-outlined cursor-pointer hover:text-primary transition-colors">security</span>
                </div>
              </div>
            </div>

            {/* Right: Contact Form */}
            <div className="lg:col-span-7">
              <div className="glass-card border border-[#494847]/20 rounded-[2rem] p-8 lg:p-12 shadow-2xl relative">
                <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Name */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant ml-1">
                        Operator Identity
                      </label>
                      <div className="relative group">
                        <input
                          className="w-full bg-surface-container-highest/50 border-none rounded-xl px-4 py-4 text-on-surface placeholder:text-on-surface-variant/30 focus:ring-1 focus:ring-primary/40 transition-all outline-none"
                          placeholder="e.g. Commander Shepard"
                          type="text"
                        />
                        <div className="absolute bottom-0 left-0 h-0.5 w-0 group-focus-within:w-full bg-primary transition-all duration-300 rounded-full shadow-[0_2px_10px_rgba(163,166,255,0.4)]"></div>
                      </div>
                    </div>
                    {/* Email */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant ml-1">
                        Secure Channel
                      </label>
                      <div className="relative group">
                        <input
                          className="w-full bg-surface-container-highest/50 border-none rounded-xl px-4 py-4 text-on-surface placeholder:text-on-surface-variant/30 focus:ring-1 focus:ring-primary/40 transition-all outline-none"
                          placeholder="name@domain.com"
                          type="email"
                        />
                        <div className="absolute bottom-0 left-0 h-0.5 w-0 group-focus-within:w-full bg-primary transition-all duration-300 rounded-full shadow-[0_2px_10px_rgba(163,166,255,0.4)]"></div>
                      </div>
                    </div>
                  </div>

                  {/* Department Selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant ml-1">
                      Department Sector
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {departments.map((dept) => (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => setSelectedDept(dept)}
                          className={`rounded-xl px-4 py-3 text-center text-xs font-medium transition-all hover:bg-surface-container-high border ${
                            selectedDept === dept
                              ? 'border-primary/50 bg-primary/5'
                              : 'bg-surface-container-low border-[#494847]/20'
                          }`}
                        >
                          {dept}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant ml-1">
                      Transmission Data
                    </label>
                    <div className="relative group">
                      <textarea
                        className="w-full bg-surface-container-highest/50 border-none rounded-xl px-4 py-4 text-on-surface placeholder:text-on-surface-variant/30 focus:ring-1 focus:ring-primary/40 transition-all outline-none resize-none"
                        placeholder="Detail your requirements for the kinetic void grid..."
                        rows={6}
                      />
                      <div className="absolute bottom-0 left-0 h-0.5 w-0 group-focus-within:w-full bg-primary transition-all duration-300 rounded-full shadow-[0_2px_10px_rgba(163,166,255,0.4)]"></div>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    className="w-full bg-primary text-on-primary py-5 rounded-xl font-headline font-extrabold text-sm uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(163,166,255,0.2)] hover:shadow-[0_15px_40px_rgba(163,166,255,0.3)] hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    <span>Initialize Transmission</span>
                    <span className="material-symbols-outlined text-base">send</span>
                  </button>

                  <p className="text-[10px] text-center text-on-surface-variant/40 uppercase tracking-widest">
                    End-to-end encryption active • Sector latency: 14ms
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Map / Bento Grid */}
        <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-24 grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-[400px] rounded-3xl overflow-hidden relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="w-full h-full object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-60 transition-all duration-700"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA7sFxoBruxZZuT-Oa03lsUpu17fuuDy_JcnjpqsK94GHrlFs6A1qhOppdDfzuaL5ztsP9WN0EMyQTwQnxXXEQaJWWZGjJ34JmIU1fyZxpQJvZ6S3ZQUmGwrwvBkRlPLgWIdfoq4NlGDhARWPNkFxR53tPnZssZ1kuqtL0AW8uUauAYNwBezLeOAN6QyzH-uGFpFRXFHakpg8tZH2siZgnUeJg1dUhDx56xupbcuDCOo1LCEisDQNtFd2sXySu4lsD0C_4laWSxOg"
              alt="Global Logistics Network"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent"></div>
            <div className="absolute bottom-8 left-8">
              <p className="text-xs font-bold text-primary mb-2">OPERATIONAL REACH</p>
              <h3 className="text-2xl font-headline font-bold text-on-surface">Global Sync Matrix</h3>
            </div>
            <div className="absolute top-1/2 left-1/3 w-3 h-3 bg-primary rounded-full shadow-[0_0_15px_#a3a6ff] animate-ping"></div>
            <div className="absolute top-1/4 left-2/3 w-2 h-2 bg-secondary rounded-full shadow-[0_0_15px_#c180ff]"></div>
          </div>
          <div className="bg-surface-container-low border border-[#494847]/10 rounded-3xl p-8 flex flex-col justify-center space-y-6">
            <div className="space-y-2">
              <p className="text-3xl font-headline font-black text-on-surface">99.9%</p>
              <p className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">Uptime Reliability</p>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-headline font-black text-on-surface">{'< 0.4s'}</p>
              <p className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">Latency Standard</p>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-headline font-black text-on-surface">244</p>
              <p className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">Secure Nodes</p>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile Bottom Nav */}
      <footer className="md:hidden fixed bottom-0 left-0 w-full z-50 h-16 rounded-t-2xl bg-[#0e0e0e]/95 backdrop-blur-md border-t border-[#494847]/20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex justify-around items-center px-4 font-inter text-[10px] uppercase tracking-widest font-bold">
        <div className="flex flex-col items-center gap-1 text-[#adaaaa] p-2">
          <span className="material-symbols-outlined text-lg">grid_view</span>
          <span>Home</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-[#adaaaa] p-2">
          <span className="material-symbols-outlined text-lg">package_2</span>
          <span>Logistics</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-[#adaaaa] p-2">
          <span className="material-symbols-outlined text-lg">explore</span>
          <span>Map</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-[#a3a6ff] drop-shadow-[0_0_8px_rgba(163,166,255,0.4)] p-2">
          <span className="material-symbols-outlined text-lg">person</span>
          <span>Profile</span>
        </div>
      </footer>

      <Footer />
    </div>
  )
}
