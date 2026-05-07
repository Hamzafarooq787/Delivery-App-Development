'use client'

import { RealtimeNotifications } from '@/components/shared/realtime-notifications'

interface HeaderProps {
  onNewDelivery?: () => void
  userId?: string
}

export default function Header({ onNewDelivery, userId }: HeaderProps) {
  return (
    <header className="fixed top-0 right-0 w-full md:w-[calc(100%-16rem)] h-16 z-40 bg-[#0e0e0e]/80 backdrop-blur-xl border-b border-outline-variant/15 shadow-2xl shadow-black/20 flex items-center justify-between px-8">
      <div className="flex items-center flex-1">
        <div className="relative w-64 group">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
          <input
            className="bg-surface-container-highest/50 border-none rounded-full py-2 pl-10 pr-4 text-sm text-on-surface focus:ring-1 focus:ring-primary/30 w-full placeholder:text-on-surface-variant/50 outline-none"
            placeholder="Search parcels, routes..."
            type="text"
          />
        </div>
      </div>
      <div className="flex items-center space-x-6">
        {userId ? (
          <RealtimeNotifications role="customer" userId={userId} />
        ) : (
          <button className="relative text-on-surface-variant hover:text-white transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
        )}
        <button className="text-on-surface-variant hover:text-white transition-colors">
          <span className="material-symbols-outlined">help_outline</span>
        </button>
        <div className="h-4 w-px bg-outline-variant/30" />
        {onNewDelivery && (
          <button
            onClick={onNewDelivery}
            className="bg-primary text-on-primary px-5 py-2 rounded-full font-bold text-xs flex items-center gap-2 hover:brightness-110 transition-all active:scale-95 shadow-[0_0_15px_rgba(163,166,255,0.2)]"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            NEW DELIVERY
          </button>
        )}
        <button className="text-sm font-inter text-white font-semibold hover:text-primary transition-colors uppercase tracking-widest text-[11px]">
          Support
        </button>
      </div>
    </header>
  )
}
