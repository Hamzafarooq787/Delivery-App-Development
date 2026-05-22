'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeNotifications } from '@/components/shared/realtime-notifications'
import { ProfileDropdown } from '@/components/shared/profile-dropdown'
import { InstallButton } from '@/components/pwa/install-button'

interface HeaderProps {
  onNewDelivery?: () => void
  userId?: string  // optional — Header self-fetches if not provided
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Header({ onNewDelivery, userId: userIdProp }: HeaderProps) {
  const supabase = useMemo(() => createClient(), [])
  const [firstName, setFirstName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [resolvedUserId, setResolvedUserId] = useState<string | undefined>(userIdProp)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      setEmail(user.email ?? '')
      if (!cancelled) setResolvedUserId(user.id)
      const { data } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()
      if (!cancelled && data?.full_name) {
        setFullName(data.full_name)
        setFirstName(data.full_name.split(' ')[0])
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const greeting = getGreeting()

  return (
    <header className="fixed top-0 right-0 w-full md:w-[calc(100%-16rem)] h-16 z-40 bg-[#0e0e0e]/90 backdrop-blur-xl border-b border-outline-variant/15 shadow-2xl shadow-black/20 flex items-center justify-between px-4 md:px-8">

      {/* ── Mobile left: brand + greeting ── */}
      <div className="flex items-center gap-3 md:hidden">
        <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
            local_shipping
          </span>
        </div>
        <div>
          <p className="text-[11px] text-on-surface-variant font-semibold tracking-wider leading-none">{greeting}</p>
          <h1 className="text-sm font-black text-white font-headline tracking-tight leading-tight">
            {firstName ? firstName : 'Kinetic Void'}
          </h1>
        </div>
      </div>

      {/* ── Desktop left: search ── */}
      <div className="hidden md:flex items-center flex-1">
        <div className="relative w-64 group">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
            search
          </span>
          <input
            className="bg-surface-container-highest/50 border-none rounded-full py-2 pl-10 pr-4 text-sm text-on-surface focus:ring-1 focus:ring-primary/30 w-full placeholder:text-on-surface-variant/50 outline-none"
            placeholder="Search parcels, routes..."
            type="text"
          />
        </div>
      </div>

      {/* ── Right: install + notifications + profile dropdown ── */}
      <div className="flex items-center gap-3 md:gap-4">
        <InstallButton />
        {/* Notifications — always shown once userId resolves */}
        {resolvedUserId ? (
          <RealtimeNotifications role="customer" userId={resolvedUserId} />
        ) : (
          <button className="relative text-on-surface-variant hover:text-white transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
        )}

        {/* Desktop-only: New Delivery button */}
        {onNewDelivery && (
          <button
            onClick={onNewDelivery}
            className="hidden md:flex bg-primary text-on-primary px-5 py-2 rounded-full font-bold text-xs items-center gap-2 hover:brightness-110 transition-all active:scale-95 shadow-[0_0_15px_rgba(163,166,255,0.2)]"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            NEW DELIVERY
          </button>
        )}

        {/* Profile dropdown — always has userId via self-fetch */}
        <ProfileDropdown
          name={fullName}
          email={email}
          role="Customer"
          activeRole="customer"
          userId={resolvedUserId}
          profileHref="/dashboard/customer/settings"
        />
      </div>
    </header>
  )
}
