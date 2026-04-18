'use client'

import { useState } from 'react'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'

const historyRows = [
  {
    id: '#KV-8291-LX',
    date: 'Oct 24, 2023',
    time: '14:22 UTC',
    origin: 'Neo-Tokyo Port Hub',
    dest: 'Berlin Sector 7 Distribution',
    value: '$2,410.00',
    status: 'Delivered',
    statusClass: 'bg-primary/10 text-primary border-primary/20',
    pulse: true,
    hoverClass: 'hover:bg-primary/5',
  },
  {
    id: '#KV-7110-RQ',
    date: 'Oct 21, 2023',
    time: '09:15 UTC',
    origin: 'Singapore Air Terminal',
    dest: 'London Gateway',
    value: '$1,150.00',
    status: 'Cancelled',
    statusClass: 'bg-error/10 text-error border-error/20',
    pulse: false,
    hoverClass: 'hover:bg-error/5',
    dimRoute: true,
  },
  {
    id: '#KV-6652-MN',
    date: 'Oct 19, 2023',
    time: '22:01 UTC',
    origin: 'Los Angeles Freight Yard',
    dest: 'Seattle Tech Hub',
    value: '$890.50',
    status: 'Returned',
    statusClass: 'bg-tertiary/10 text-tertiary border-tertiary/20',
    pulse: false,
    hoverClass: 'hover:bg-tertiary/5',
  },
  {
    id: '#KV-5420-ZA',
    date: 'Oct 18, 2023',
    time: '11:45 UTC',
    origin: 'Paris Logistics Center',
    dest: 'Milan Fashion Depot',
    value: '$1,840.25',
    status: 'Delivered',
    statusClass: 'bg-primary/10 text-primary border-primary/20',
    pulse: false,
    hoverClass: 'hover:bg-primary/5',
  },
  {
    id: '#KV-4911-WE',
    date: 'Oct 15, 2023',
    time: '04:30 UTC',
    origin: 'Dubai Cargo Port',
    dest: 'Mumbai Industrial Estate',
    value: '$5,620.00',
    status: 'Delivered',
    statusClass: 'bg-primary/10 text-primary border-primary/20',
    pulse: false,
    hoverClass: 'hover:bg-primary/5',
  },
]

export default function DeliveryHistoryPage() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} />
      <main className="pt-24 pb-12 md:ml-64 px-8 min-h-screen bg-surface-container-low">
        {/* Header Section */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-4xl font-extrabold font-headline tracking-tighter text-on-surface">
              Shipment History
            </h2>
            <p className="text-on-surface-variant mt-2 font-medium text-sm">
              Tracking 1,284 completed transits within the Kinetic Void.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-highest border border-outline-variant/20 rounded-lg text-sm font-medium hover:bg-surface-container transition-colors text-on-surface">
              <span className="material-symbols-outlined text-sm">calendar_today</span>
              Last 30 Days
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-highest border border-outline-variant/20 rounded-lg text-sm font-medium hover:bg-surface-container transition-colors text-on-surface">
              <span className="material-symbols-outlined text-sm">filter_list</span>
              All Statuses
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-highest hover:bg-surface-container-high transition-colors text-primary rounded-lg text-sm font-bold border border-primary/20">
              <span className="material-symbols-outlined text-sm">download</span>
              Export CSV
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className="glass-card rounded-2xl overflow-hidden border border-outline-variant/10 shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-lowest/30">
                {['Waybill ID', 'Timeline', 'Route (Pickup → Drop)', 'Value', 'Status', ''].map(
                  (col) => (
                    <th
                      key={col}
                      className={`px-6 py-5 text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant font-headline ${col === 'Status' ? 'text-center' : ''}`}
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {historyRows.map((row) => (
                <tr
                  key={row.id}
                  className={`group ${row.hoverClass} transition-all cursor-pointer`}
                >
                  <td className="px-6 py-5">
                    <span className="text-sm font-bold text-primary font-headline">{row.id}</span>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm text-on-surface font-medium">{row.date}</p>
                    <p className="text-[10px] text-on-surface-variant">{row.time}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className={`flex items-center gap-3 ${row.dimRoute ? 'text-on-surface-variant' : ''}`}>
                      <div className="flex flex-col items-center">
                        <div className={`w-1.5 h-1.5 rounded-full ${row.dimRoute ? 'bg-outline opacity-50' : 'bg-primary shadow-[0_0_8px_rgba(163,166,255,0.6)]'}`} />
                        <div className="w-[1px] h-4 border-l border-dashed border-outline-variant my-0.5" />
                        <div className={`w-1.5 h-1.5 rounded-full ${row.dimRoute ? 'bg-outline opacity-50' : 'bg-secondary shadow-[0_0_8px_rgba(193,128,255,0.6)]'}`} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-on-surface">{row.origin}</p>
                        <p className="text-xs font-semibold text-on-surface mt-1.5">{row.dest}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm font-bold text-on-surface">{row.value}</span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold border uppercase tracking-tighter ${row.statusClass}`}
                    >
                      {row.pulse && (
                        <span className="w-1 h-1 rounded-full bg-primary mr-1.5 animate-pulse" />
                      )}
                      {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">
                      arrow_forward_ios
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Footer */}
          <div className="px-6 py-6 flex items-center justify-between bg-surface-container-highest/20">
            <div className="text-xs font-medium text-on-surface-variant">
              Showing <span className="text-on-surface">1-10</span> of{' '}
              <span className="text-on-surface">1,284</span> shipments
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-xs font-bold bg-surface-container-highest/50 text-on-surface-variant rounded-lg border border-outline-variant/10 hover:bg-surface-container-high transition-colors">
                Previous
              </button>
              {[1, 2, 3].map((p) => (
                <button
                  key={p}
                  className={`px-4 py-2 text-xs font-bold rounded-lg border transition-colors ${
                    p === 1
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface-container-highest/50 text-on-surface-variant border-outline-variant/10 hover:bg-surface-container-high'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button className="px-4 py-2 text-xs font-bold bg-surface-container-highest/50 text-on-surface-variant rounded-lg border border-outline-variant/10 hover:bg-surface-container-high transition-colors">
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}
