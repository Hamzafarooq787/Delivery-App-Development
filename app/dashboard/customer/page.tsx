'use client'

import { useState } from 'react'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'

const recentDeliveries = [
  {
    id: 'KV-98234-LX',
    route: 'Los Angeles, CA → Austin, TX',
    icon: 'package_2',
    iconColor: 'text-primary',
    bg: 'bg-surface-container-highest',
    label: 'Scheduled for',
    detail: 'Oct 24, 14:00',
    status: 'IN TRANSIT',
    statusClass: 'bg-primary/10 text-primary border border-primary/20',
  },
  {
    id: 'KV-77210-BC',
    route: 'Seattle, WA → Portland, OR',
    icon: 'inventory_2',
    iconColor: 'text-secondary',
    bg: 'bg-surface-container-highest',
    label: 'Completed on',
    detail: 'Oct 21, 09:30',
    status: 'DELIVERED',
    statusClass: 'bg-outline-variant/20 text-on-surface-variant',
  },
  {
    id: 'KV-11204-DP',
    route: 'Miami, FL → New York, NY',
    icon: 'warning',
    iconColor: 'text-error',
    bg: 'bg-surface-container-highest',
    label: 'Delayed by',
    detail: 'Weather Event',
    detailClass: 'text-error',
    status: 'DELAYED',
    statusClass: 'bg-error/10 text-error border border-error/20',
  },
]

export default function CustomerDashboardPage() {
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState('Overview')
  const tabs = ['Overview', 'Quick Book', 'Active Tracking', 'History']

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} />
      <main className="pt-16 md:pl-64 min-h-screen bg-surface-container-low">
        <div className="max-w-7xl mx-auto p-8 pb-32">
          {/* Page Header & Sub-Tabs */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-headline text-3xl font-extrabold text-on-surface tracking-tighter">
                  Command Center
                </h2>
                <p className="text-on-surface-variant mt-1 text-sm">
                  Real-time logistics overview and orchestration.
                </p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="bg-primary text-on-primary px-6 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 shadow-[0_0_15px_rgba(163,166,255,0.1)] hover:brightness-110 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                NEW SHIPMENT
              </button>
            </div>
            {/* Sub-Navigation Tabs */}
            <div className="flex gap-8 border-b border-outline-variant/10">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-4 text-sm transition-all ${
                    activeTab === tab
                      ? 'font-bold text-primary border-b-2 border-primary'
                      : 'font-medium text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-12 gap-6">
            {/* Stat Card: Active Deliveries */}
            <div className="col-span-12 md:col-span-4 glass-card p-6 rounded-2xl flex flex-col justify-between h-48">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mb-1">
                    Active Deliveries
                  </p>
                  <h3 className="font-headline text-4xl font-extrabold text-on-surface">24</h3>
                </div>
                <div className="bg-primary/10 p-2 rounded-lg">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    local_shipping
                  </span>
                </div>
              </div>
              <div className="h-12 w-full mt-4 opacity-50 flex items-end gap-1">
                {[4, 8, 6, 10, 5, 9, 12].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary rounded-t-sm"
                    style={{ height: `${h * 4}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Stat Card: Completed */}
            <div className="col-span-12 md:col-span-4 glass-card p-6 rounded-2xl flex flex-col justify-between h-48">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mb-1">
                    Completed MTD
                  </p>
                  <h3 className="font-headline text-4xl font-extrabold text-on-surface">1,482</h3>
                </div>
                <div className="bg-secondary/10 p-2 rounded-lg">
                  <span
                    className="material-symbols-outlined text-secondary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    task_alt
                  </span>
                </div>
              </div>
              <div className="h-12 w-full mt-4 opacity-50 flex items-end gap-1">
                {[8, 5, 11, 6, 10, 4, 7].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-secondary rounded-t-sm"
                    style={{ height: `${h * 4}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Stat Card: Total Spent */}
            <div className="col-span-12 md:col-span-4 glass-card p-6 rounded-2xl flex flex-col justify-between h-48">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mb-1">
                    Total Spent (USD)
                  </p>
                  <h3 className="font-headline text-4xl font-extrabold text-on-surface">$12.4k</h3>
                </div>
                <div className="bg-tertiary/10 p-2 rounded-lg">
                  <span
                    className="material-symbols-outlined text-tertiary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    payments
                  </span>
                </div>
              </div>
              <div className="h-12 w-full mt-4 opacity-50 flex items-end gap-1">
                {[10, 4, 6, 8, 11, 5, 9].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-tertiary rounded-t-sm"
                    style={{ height: `${h * 4}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Recent Deliveries List */}
            <div className="col-span-12 lg:col-span-8 bg-surface-container p-6 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-headline text-lg font-bold text-on-surface">Recent Deliveries</h4>
                <button className="text-primary text-xs font-bold uppercase tracking-widest hover:underline">
                  View All
                </button>
              </div>
              <div className="space-y-2">
                {recentDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="flex items-center justify-between p-4 rounded-xl hover:bg-surface-container-high transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 ${delivery.bg} rounded-full flex items-center justify-center ${delivery.iconColor}`}
                      >
                        <span className="material-symbols-outlined">{delivery.icon}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">{delivery.id}</p>
                        <p className="text-xs text-on-surface-variant">{delivery.route}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-6">
                      <div className="hidden md:block">
                        <p className="text-xs text-on-surface-variant">{delivery.label}</p>
                        <p className={`text-xs font-medium ${delivery.detailClass ?? ''}`}>
                          {delivery.detail}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-3 py-1 rounded-full ${delivery.statusClass}`}
                      >
                        {delivery.status}
                      </span>
                      <span className="material-symbols-outlined text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">
                        chevron_right
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Book Widget */}
            <div className="col-span-12 lg:col-span-4 bg-surface-container p-8 rounded-2xl border border-outline-variant/10 relative overflow-hidden">
              <div className="absolute -right-16 -top-16 w-48 h-48 bg-primary/10 blur-[60px] rounded-full" />
              <div className="relative z-10">
                <h4 className="font-headline text-lg font-bold text-on-surface mb-2">Quick Book</h4>
                <p className="text-sm text-on-surface-variant mb-6">Dispatch a local courier in seconds.</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider mb-1 block">
                      Pick-up Location
                    </label>
                    <div className="relative">
                      <input
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 pl-10 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 outline-none"
                        type="text"
                        defaultValue="HQ Main Office, CA"
                      />
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-[18px]">
                        location_on
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider mb-1 block">
                      Destination
                    </label>
                    <div className="relative">
                      <input
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 pl-10 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 outline-none"
                        placeholder="Enter address..."
                        type="text"
                      />
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                        navigation
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider mb-1 block">
                        Weight
                      </label>
                      <select className="w-full bg-surface-container-highest border-none rounded-xl py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary/50">
                        <option>0-5 kg</option>
                        <option>5-20 kg</option>
                        <option>20kg+</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider mb-1 block">
                        Priority
                      </label>
                      <select className="w-full bg-surface-container-highest border-none rounded-xl py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary/50">
                        <option>Standard</option>
                        <option>Express</option>
                        <option>Instant</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowModal(true)}
                    className="w-full bg-on-surface text-surface py-4 rounded-xl font-bold uppercase tracking-widest text-xs mt-4 hover:bg-primary hover:text-on-primary transition-all active:scale-95"
                  >
                    Estimate Cost
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}
