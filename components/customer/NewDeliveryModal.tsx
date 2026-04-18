'use client'

import { useState } from 'react'

interface NewDeliveryModalProps {
  onClose: () => void
}

export default function NewDeliveryModal({ onClose }: NewDeliveryModalProps) {
  const [step, setStep] = useState(1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-surface-container-low rounded-2xl border border-outline-variant/20 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-outline-variant/10">
          <div>
            <h2 className="text-2xl font-extrabold font-headline tracking-tighter text-on-surface">
              Initialize New Delivery
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">
              Precision routing for the kinetic supply chain.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:text-white hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-8">
          {/* Stepper */}
          <div className="flex items-center space-x-6 mb-10">
            {[
              { num: 1, label: 'Logistics Path' },
              { num: 2, label: 'Payload Specs' },
              { num: 3, label: 'Validation' },
            ].map((s, idx) => (
              <div key={s.num} className="flex items-center flex-1">
                <div className={`flex items-center space-x-3 ${step < s.num ? 'opacity-40' : ''}`}>
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      step >= s.num
                        ? 'bg-primary text-on-primary'
                        : 'border border-outline-variant text-on-surface-variant'
                    }`}
                  >
                    {s.num}
                  </span>
                  <span className="text-on-surface text-sm font-semibold hidden sm:block">
                    {s.label}
                  </span>
                </div>
                {idx < 2 && <div className="h-px flex-1 bg-outline-variant/30 mx-4" />}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* Main Form */}
            <div className="col-span-12 lg:col-span-8 space-y-8">
              {/* Step 1: Address */}
              <section className="glass-card rounded-2xl p-8 border border-outline-variant/10">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-bold font-headline mb-1">Logistics Path</h3>
                    <p className="text-on-surface-variant text-xs">
                      Define origin and destination coordinates.
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-primary">distance</span>
                </div>
                <div className="space-y-6">
                  {/* Origin */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-primary mb-2">
                      <span className="material-symbols-outlined text-sm">location_on</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest">Origin Node</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <input
                        className="w-full bg-surface-container-highest border border-outline-variant/10 focus:border-primary rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/40 transition-all outline-none text-sm"
                        placeholder="Street Address"
                        type="text"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          className="w-full bg-surface-container-highest border border-outline-variant/10 focus:border-primary rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/40 transition-all outline-none text-sm"
                          placeholder="City / Zone"
                          type="text"
                        />
                        <input
                          className="w-full bg-surface-container-highest border border-outline-variant/10 focus:border-primary rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/40 transition-all outline-none text-sm"
                          placeholder="Postal Code"
                          type="text"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 py-2">
                    <div className="h-px flex-1 bg-outline-variant/20" />
                    <span className="material-symbols-outlined text-on-surface-variant text-sm">
                      arrow_downward
                    </span>
                    <div className="h-px flex-1 bg-outline-variant/20" />
                  </div>

                  {/* Destination */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-secondary mb-2">
                      <span className="material-symbols-outlined text-sm">flag</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        Destination Node
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <input
                        className="w-full bg-surface-container-highest border border-outline-variant/10 focus:border-secondary rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/40 transition-all outline-none text-sm"
                        placeholder="Enter target coordinates..."
                        type="text"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          className="w-full bg-surface-container-highest border border-outline-variant/10 focus:border-secondary rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/40 transition-all outline-none text-sm"
                          placeholder="City / Zone"
                          type="text"
                        />
                        <input
                          className="w-full bg-surface-container-highest border border-outline-variant/10 focus:border-secondary rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/40 transition-all outline-none text-sm"
                          placeholder="000-000"
                          type="text"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Step 2: Payload Specs (dimmed preview) */}
              <section className="glass-card rounded-2xl p-8 opacity-60 border border-outline-variant/10">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold font-headline mb-1">Payload Specs</h3>
                    <p className="text-on-surface-variant text-xs">
                      Configure weight and volumetric dimensions.
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant">inventory_2</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { icon: 'package_2', label: 'Standard Box' },
                    { icon: 'pallet', label: 'Heavy Pallet' },
                    { icon: 'precision_manufacturing', label: 'Fragile Core' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="bg-surface-container-highest/40 p-4 rounded-xl border border-outline-variant/10 flex flex-col items-center justify-center space-y-2"
                    >
                      <span className="material-symbols-outlined text-on-surface-variant">
                        {item.icon}
                      </span>
                      <span className="text-xs font-bold">{item.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Live Projection Sidebar */}
            <div className="col-span-12 lg:col-span-4">
              <div className="glass-card rounded-2xl p-8 border border-primary/20 shadow-[0_0_20px_rgba(163,166,255,0.1)] sticky top-4">
                <div className="flex items-center justify-between mb-8">
                  <h4 className="text-xs uppercase tracking-[0.2em] font-extrabold text-primary">
                    Live Projection
                  </h4>
                  <span className="material-symbols-outlined text-primary text-sm animate-pulse">
                    monitoring
                  </span>
                </div>
                <div className="space-y-6 pb-8 border-b border-outline-variant/20">
                  <div className="flex justify-between items-baseline">
                    <span className="text-on-surface-variant text-sm">Base Dispatch Fee</span>
                    <span className="text-on-surface font-mono font-medium">$42.00</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-on-surface-variant text-sm">Route Density Factor</span>
                    <span className="text-on-surface font-mono font-medium">+$8.45</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-on-surface-variant text-sm">Kinetic Priority</span>
                    <span className="text-tertiary font-mono font-medium">Included</span>
                  </div>
                </div>
                <div className="mt-8 mb-10">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-2 font-bold">
                    Estimated Total
                  </p>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-5xl font-black font-headline text-on-surface tracking-tighter">
                      $50.45
                    </span>
                    <span className="text-on-surface-variant text-xs">USD</span>
                  </div>
                </div>
                <button className="w-full bg-primary hover:brightness-110 text-on-primary font-black py-4 rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(163,166,255,0.4)] flex items-center justify-center space-x-3 text-sm">
                  <span>Confirm &amp; Pay</span>
                  <span className="material-symbols-outlined">bolt</span>
                </button>
                <div className="mt-6 p-4 bg-surface-container-low rounded-lg border border-outline-variant/10">
                  <div className="flex items-center space-x-3 mb-2">
                    <span
                      className="material-symbols-outlined text-[16px] text-secondary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      verified
                    </span>
                    <p className="text-[10px] font-bold text-on-surface">Kinetic Secure Promise</p>
                  </div>
                  <p className="text-[10px] leading-relaxed text-on-surface-variant">
                    Your shipment is protected by quantum-mesh encryption and 24/7 autonomous monitoring
                    during transit.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
