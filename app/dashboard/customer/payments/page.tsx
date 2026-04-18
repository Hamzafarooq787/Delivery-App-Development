'use client'

import { useState } from 'react'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'

const transactions = [
  {
    icon: 'local_shipping',
    iconColor: 'text-primary',
    hoverBg: 'group-hover:bg-primary group-hover:text-on-primary',
    title: 'Dispatch Settle: #VO-8812',
    date: 'Oct 24, 2023 • 14:32',
    amount: '-$1,240.00',
    status: 'Completed',
    statusColor: 'text-primary',
  },
  {
    icon: 'bolt',
    iconColor: 'text-secondary',
    hoverBg: 'group-hover:bg-secondary group-hover:text-on-secondary',
    title: 'Dynamic Routing Surcharge',
    date: 'Oct 22, 2023 • 09:15',
    amount: '-$45.20',
    status: 'Completed',
    statusColor: 'text-primary',
  },
  {
    icon: 'warning',
    iconColor: 'text-error',
    hoverBg: 'group-hover:bg-error group-hover:text-on-error',
    title: 'Fuel Surcharge Adjustment',
    date: 'Oct 21, 2023 • 18:44',
    amount: '-$312.00',
    status: 'Refund Pending',
    statusColor: 'text-error',
  },
  {
    icon: 'inventory_2',
    iconColor: 'text-on-surface-variant',
    hoverBg: 'group-hover:bg-on-surface-variant group-hover:text-surface',
    title: 'Warehouse Lease Extension',
    date: 'Oct 19, 2023 • 11:20',
    amount: '-$4,500.00',
    status: 'Completed',
    statusColor: 'text-primary',
  },
]

export default function PaymentsPage() {
  const [showModal, setShowModal] = useState(false)
  const [autoReload] = useState(true)

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} />
      <main className="pt-24 pb-12 md:ml-64 px-8 min-h-screen bg-surface-container-low">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <header className="mb-10">
            <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface">
              Payment Systems
            </h2>
            <p className="text-on-surface-variant mt-2 text-sm">
              Manage your kinetic billing credits and automated settlement methods.
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left: Saved Methods + Transactions (2/3) */}
            <div className="lg:col-span-2 space-y-8">
              {/* Saved Cards */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold font-headline text-on-surface flex items-center">
                    <span className="material-symbols-outlined mr-2 text-primary">credit_card</span>
                    Saved Methods
                  </h3>
                  <button className="text-xs font-bold text-primary hover:text-primary-fixed transition-colors flex items-center bg-primary/10 px-3 py-1.5 rounded-full">
                    <span className="material-symbols-outlined text-sm mr-1">add</span>
                    Add New Card
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Card 1 */}
                  <div className="glass-card p-6 rounded-xl relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer border border-outline-variant/15">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -mr-16 -mt-16 rounded-full group-hover:bg-primary/20 transition-colors" />
                    <div className="flex justify-between items-start mb-12">
                      <span className="material-symbols-outlined text-3xl text-on-surface">contactless</span>
                      <div className="w-12 h-8 bg-surface-container rounded-lg flex items-center justify-center">
                        <div className="flex -space-x-2">
                          <div className="w-5 h-5 rounded-full bg-[#eb001b] opacity-80" />
                          <div className="w-5 h-5 rounded-full bg-[#f79e1b] opacity-80" />
                        </div>
                      </div>
                    </div>
                    <div className="mb-6">
                      <p className="text-xl font-headline tracking-[0.2em] text-on-surface">
                        •••• •••• •••• 4492
                      </p>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">
                          Card Holder
                        </p>
                        <p className="text-sm font-medium text-on-surface">KINETIC GLOBAL LTD</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">
                          Expiry
                        </p>
                        <p className="text-sm font-medium text-on-surface">09 / 26</p>
                      </div>
                    </div>
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="material-symbols-outlined text-on-surface-variant hover:text-error transition-colors">
                        delete
                      </span>
                    </div>
                  </div>

                  {/* Card 2 (Primary) */}
                  <div className="glass-card p-6 rounded-xl relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer border border-primary/30">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 blur-3xl -mr-16 -mt-16 rounded-full" />
                    <div className="flex justify-between items-start mb-12">
                      <span className="material-symbols-outlined text-3xl text-primary">verified_user</span>
                      <span className="text-xs bg-primary text-on-primary font-bold px-2 py-0.5 rounded-full tracking-tighter">
                        PRIMARY
                      </span>
                    </div>
                    <div className="mb-6">
                      <p className="text-xl font-headline tracking-[0.2em] text-on-surface">
                        •••• •••• •••• 8810
                      </p>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">
                          Card Holder
                        </p>
                        <p className="text-sm font-medium text-on-surface">VOIDSYS OPERATIONAL</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">
                          Expiry
                        </p>
                        <p className="text-sm font-medium text-on-surface">12 / 28</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Transactions */}
              <section>
                <h3 className="text-lg font-bold font-headline text-on-surface mb-6 flex items-center">
                  <span className="material-symbols-outlined mr-2 text-secondary">history</span>
                  Transaction History
                </h3>
                <div className="bg-surface-container rounded-xl overflow-hidden">
                  <div className="p-6 space-y-4">
                    {transactions.map((tx) => (
                      <div
                        key={tx.title}
                        className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg hover:bg-surface-container-high transition-colors group"
                      >
                        <div className="flex items-center space-x-4">
                          <div
                            className={`w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center ${tx.iconColor} ${tx.hoverBg} transition-all`}
                          >
                            <span className="material-symbols-outlined">{tx.icon}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-on-surface">{tx.title}</p>
                            <p className="text-xs text-on-surface-variant">{tx.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-on-surface">{tx.amount}</p>
                          <p className={`text-[10px] ${tx.statusColor} flex items-center justify-end`}>
                            <span className={`w-1 h-1 rounded-full mr-1 ${tx.statusColor === 'text-primary' ? 'bg-primary' : 'bg-error'}`} />
                            {tx.status}
                          </p>
                        </div>
                      </div>
                    ))}
                    <button className="w-full mt-6 py-3 border border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all text-xs font-bold tracking-widest uppercase rounded-lg">
                      Load Complete Ledger
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {/* Right: Billing Summary (1/3) */}
            <div className="space-y-6">
              {/* Billing Card */}
              <div className="bg-surface-container-high p-8 rounded-2xl relative overflow-hidden border border-outline-variant/10">
                <div className="relative z-10">
                  <p className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-2">
                    Available Credit
                  </p>
                  <h4 className="text-4xl font-headline font-black text-on-surface mb-6">$14,250.00</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant">Monthly Burn</span>
                      <span className="text-on-surface font-bold text-error">+$4,210.00</span>
                    </div>
                    <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: '65%' }} />
                    </div>
                    <p className="text-[10px] text-on-surface-variant">
                      Using 65% of your recommended kinetic buffer.
                    </p>
                  </div>
                  <div className="mt-8 pt-8 border-t border-outline-variant/20">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-bold text-on-surface">Auto-Reload</p>
                      <div
                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                          autoReload ? 'bg-primary' : 'bg-surface-container-highest'
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-3 h-3 bg-on-primary rounded-full transition-all ${
                            autoReload ? 'right-1' : 'left-1'
                          }`}
                        />
                      </div>
                    </div>
                    <button className="w-full py-4 bg-surface-container-lowest border border-primary/30 text-primary font-headline font-bold rounded-xl hover:bg-primary/5 transition-all text-sm uppercase tracking-widest">
                      Top Up Credits
                    </button>
                  </div>
                </div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary/5 blur-3xl rounded-full" />
              </div>

              {/* Security Badge */}
              <div className="bg-[#0e0e0e] border border-outline-variant/10 p-6 rounded-2xl flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center text-primary">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    verified
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface">Secure Financial Terminal</p>
                  <p className="text-[10px] text-on-surface-variant">256-bit Kinetic Encryption Active</p>
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
