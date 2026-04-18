'use client'

import { useState } from 'react'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'

const shipments = [
  {
    id: 'KV-9821-X',
    origin: 'Neo Tokyo Port',
    destination: 'London Gateway',
    driver: 'Marcus Chen',
    driverRole: 'Class-A Lead',
    status: 'In Transit',
    statusClass: 'bg-primary/10 text-primary',
    driverInitial: 'MC',
    driverBg: 'bg-primary',
    featured: false,
    image: null,
    alert: null,
  },
  {
    id: 'KV-7720-Y',
    origin: 'Berlin Logistics Hub',
    destination: 'Paris Orly Depot',
    driver: 'Elena Vance',
    driverRole: 'Fleet Expert',
    status: 'Optimizing',
    statusClass: 'bg-secondary/10 text-secondary',
    driverInitial: 'EV',
    driverBg: 'bg-secondary',
    featured: false,
    image: null,
    alert: null,
  },
  {
    id: 'KV-1102-Z',
    origin: 'Shanghai Port',
    destination: 'Los Angeles (LAX)',
    driver: 'David Miller',
    driverRole: 'Pacific Route Lead',
    status: 'Rerouted',
    statusClass: 'bg-error/10 text-error',
    driverInitial: 'DM',
    driverBg: 'bg-error',
    featured: true,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBoGugX1SSreUCV7kPTmSz3wEfOZmaSx-LMIRw11_8uO3uGQg0n38w_3sGXxYG-X5lgroosrMxyi5iUQUUiijGgZLnq4vPUTA1RrOpbQTZSMgCPsxjvIlpvjSFOGRuGsi3DcCbOB36F0__c5alKUWFKyWoyHyNS4FFi9EV_Gu-JxwARn1-XxAdUnZy2b6Re4F15L3PYNUU_VuIuDrnvt8hZsTZdbNDskMpy3OBNYEQev2s5EQi9WTyNdpY9AHLKxyhgnob3pqQslw',
    alert: {
      icon: 'warning',
      title: 'Delay Detected',
      message: 'Severe weather conditions at Pacific Corridor. Estimated arrival +4h.',
    },
  },
  {
    id: 'KV-4451-A',
    origin: 'Singapore Yard',
    destination: 'Sydney Terminal',
    driver: 'Sasha Petrov',
    driverRole: 'Senior Op',
    status: 'In Transit',
    statusClass: 'bg-primary/10 text-primary',
    driverInitial: 'SP',
    driverBg: 'bg-tertiary',
    featured: false,
    image: null,
    alert: null,
  },
]

export default function ActiveDeliveriesPage() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} />
      <main className="pt-24 pb-20 md:pb-8 pl-4 pr-4 md:pl-72 md:pr-8 min-h-screen bg-surface-container-low">
        {/* Header Section */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
              Active Deliveries
            </h2>
            <p className="text-on-surface-variant font-body text-sm mt-1">
              Real-time status of your kinetic fleet across global corridors.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-surface-container rounded-xl px-4 py-2 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#a3a6ff]" />
              <span className="font-label text-xs font-semibold text-on-surface uppercase tracking-widest">
                12 Operations Live
              </span>
            </div>
          </div>
        </div>

        {/* Bento Grid for Shipments */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shipments.map((shipment) => (
            <div
              key={shipment.id}
              className={`bg-surface-container rounded-xl overflow-hidden group transition-all duration-300 hover:bg-surface-container-high relative border border-transparent hover:border-primary/10 ${
                shipment.featured ? 'lg:row-span-2' : ''
              }`}
            >
              <div className="absolute top-0 right-0 p-4">
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${shipment.statusClass}`}>
                  {shipment.status}
                </span>
              </div>

              {shipment.image && (
                <div className="h-48 w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shipment.image}
                    alt={`${shipment.id} warehouse`}
                    className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
                  />
                </div>
              )}

              <div className="p-6">
                <p className="text-[10px] font-label text-on-surface-variant uppercase tracking-[0.2em] mb-4">
                  Order ID: {shipment.id}
                </p>
                <div className="flex flex-col gap-6 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">location_on</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-on-surface-variant uppercase font-semibold">Origin</p>
                      <p className="text-on-surface font-headline font-bold">{shipment.origin}</p>
                    </div>
                  </div>
                  <div className="ml-5 h-6 border-l-2 border-dashed border-outline-variant" />
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined">flag</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-on-surface-variant uppercase font-semibold">
                        Destination
                      </p>
                      <p className="text-on-surface font-headline font-bold">{shipment.destination}</p>
                    </div>
                  </div>
                </div>

                {shipment.alert && (
                  <div className="bg-surface-container-highest p-4 rounded-xl mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-error text-sm">
                        {shipment.alert.icon}
                      </span>
                      <span className="text-xs font-bold text-error uppercase tracking-widest">
                        {shipment.alert.title}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant">{shipment.alert.message}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-6 border-t border-outline-variant/10">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full ${shipment.driverBg} flex items-center justify-center text-[10px] font-bold text-white`}
                    >
                      {shipment.driverInitial}
                    </div>
                    <div className="text-xs">
                      <p className="text-on-surface font-medium">{shipment.driver}</p>
                      <p className="text-on-surface-variant">{shipment.driverRole}</p>
                    </div>
                  </div>
                  <button className="bg-primary text-on-primary px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(163,166,255,0.2)]">
                    Track
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}
