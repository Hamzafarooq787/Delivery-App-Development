"use client"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Box, ShoppingBag, MapPin, ArrowRight, ChevronRight, Truck, Wallet, CircleHelp, Home, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getWalletBalance } from '@/app/actions/wallet'
import { getBfmSettings } from '@/app/actions/shopping'
import { BrandLogo } from '@/components/shared/brand-logo'
import { ProfileDropdown } from '@/components/shared/profile-dropdown'
import { RealtimeNotifications } from '@/components/shared/realtime-notifications'
import { useVisibleViewport } from '@/hooks/use-visible-viewport'
import { ServiceIllustration } from './ServiceIllustration'
import styles from './CustomerHome.module.css'
const ShoppingModal = dynamic(() => import('./NewShoppingRequestModal').then(m => m.NewShoppingRequestModal), { ssr: false })
const nav = [
  { href: '/dashboard/customer', label: 'Home', icon: Home },
  { href: '/dashboard/customer/active-deliveries', label: 'Deliveries', icon: Truck },
  { href: '/dashboard/customer/wallet', label: 'Wallet', icon: Wallet },
  { href: '/dashboard/customer/settings', label: 'Account', icon: UserRound },
]
export default function CustomerHome() {
  const screenRef = useVisibleViewport()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState({ id: '', name: '', email: '' })
  const [balance, setBalance] = useState<number | null>(null)
  const [delivery, setDelivery] = useState<{ tracking_number: string | null; status: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [shoppingEnabled, setShoppingEnabled] = useState(false)
  const [shopping, setShopping] = useState(false)
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const [person, deliveries, wallet, settings] = await Promise.all([
          supabase.from('users').select('full_name').eq('id', user.id).maybeSingle(),
          supabase.from('delivery_requests').select('tracking_number,status').eq('customer_id', user.id).not('status', 'in', '("delivered","cancelled")').order('created_at', { ascending: false }).limit(1),
          getWalletBalance().catch(() => ({ balance: null })),
          getBfmSettings().catch(() => ({ enabled: false })),
        ])
        if (cancelled) return
        setProfile({ id: user.id, name: person.data?.full_name || '', email: user.email || '' })
        setDelivery(deliveries.data?.[0] ?? null)
        setLoadError(!!deliveries.error)
        setBalance(wallet.balance)
        setShoppingEnabled(settings.enabled !== false)
      } catch { if (!cancelled) setLoadError(true) }
      finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [supabase])
  // Layout owns the modal and draft-resume flow. A single event opens it once.
  function book(focus?: 'pickup' | 'delivery') {
    document.dispatchEvent(new CustomEvent('open-new-delivery', { detail: { focus } }))
  }
  const deliveryLabel = loading ? 'Loading your deliveries…' : loadError ? 'View your deliveries' : delivery ? `${delivery.tracking_number || 'Active delivery'} · ${(delivery.status || 'requested').replaceAll('_', ' ')}` : 'No deliveries yet.'
  const walletLabel = balance === null ? '—' : `${balance < 0 ? '-' : ''}£${Math.abs(balance).toFixed(2)}`
  return <div ref={screenRef} className={styles.screen}>
    <header className={styles.header}>
      <Link href="/" aria-label="GoDrop website"><BrandLogo /></Link>
      <nav className={styles.desktopNav} aria-label="Customer navigation">
        <Link href="/dashboard/customer" aria-current="page"><Home size={18} aria-hidden />Home</Link>
        <Link href="/dashboard/customer/active-deliveries"><Truck size={18} aria-hidden />My deliveries</Link>
        <Link href="/dashboard/customer/payments"><Wallet size={18} aria-hidden />Payments</Link>
        <Link href="/dashboard/customer/support"><CircleHelp size={18} aria-hidden />Help</Link>
      </nav>
      <div className={styles.profile}>{profile.id && <RealtimeNotifications role="customer" userId={profile.id} />}<ProfileDropdown name={profile.name} email={profile.email} activeRole="customer" userId={profile.id} profileHref="/dashboard/customer/settings" supportHref="/dashboard/customer/support" /></div>
    </header>
    <main className={styles.desktopMain} aria-label="Customer desktop home">
      <div className={styles.desktopGreeting}><p>GOOD TO SEE YOU</p><h1>{profile.name ? `Hi, ${profile.name.split(' ')[0]}.` : 'Welcome back.'}</h1><h2>What do you need today?</h2><span>Fast, reliable deliveries and shopping, all in one place.</span></div>
      <div className={styles.desktopServices}>
        <section className={`${styles.serviceCard} ${styles.deliveryCard}`} aria-labelledby="collect-heading">
          <div className={styles.serviceIcon}><Box size={27} aria-hidden /></div>
          <div className={styles.serviceCopy}><h3 id="collect-heading">Collect &amp; Deliver</h3><p>Send anything, anywhere. We collect from you and deliver it safely.</p><button onClick={() => book()}>Book a delivery <ArrowRight size={18} aria-hidden /></button></div>
          <div className={styles.serviceArt}><ServiceIllustration kind="parcel" /></div>
        </section>
        <section className={styles.serviceCard} aria-labelledby="shopping-heading">
          <div className={styles.serviceIcon}><ShoppingBag size={27} aria-hidden /></div>
          {!shoppingEnabled && <span className={styles.comingSoon}>Coming soon</span>}
          <div className={styles.serviceCopy}><h3 id="shopping-heading">Buy for Me</h3><p>We shop for it, so you don&apos;t have to. Tell us what you need and we&apos;ll take care of the rest.</p>{shoppingEnabled && <button className={styles.shoppingButton} onClick={() => setShopping(true)}>Start shopping <ArrowRight size={18} aria-hidden /></button>}</div>
          <div className={`${styles.serviceArt} ${styles.bagArt}`}><ServiceIllustration kind="shopping" /></div>
        </section>
      </div>
      <Link className={styles.desktopDeliveries} href="/dashboard/customer/active-deliveries"><span className={styles.shortcutIcon}><Truck aria-hidden /></span><span><strong>Your deliveries</strong><small>{deliveryLabel}{!loading && !loadError && !delivery && <><br />Book your first delivery to get started.</>}</small></span><ChevronRight size={20} aria-hidden /></Link>
      <div className={styles.desktopShortcuts}>
        <Link href="/dashboard/customer/wallet"><span className={styles.shortcutIcon}><Wallet aria-hidden /></span><span><small>Wallet balance</small><strong>{walletLabel}</strong></span><ChevronRight size={18} aria-hidden /></Link>
        <Link href="/dashboard/customer/addresses"><span className={styles.shortcutIcon}><MapPin aria-hidden /></span><span><strong>Saved addresses</strong><small>Manage your pickup and delivery addresses.</small></span><ChevronRight size={18} aria-hidden /></Link>
        <Link href="/dashboard/customer/support"><span className={styles.shortcutIcon}><CircleHelp aria-hidden /></span><span><strong>Get help</strong><small>Support, FAQs and live chat.</small></span><ChevronRight size={18} aria-hidden /></Link>
      </div>
    </main>
    <main className={styles.main} aria-label="Customer mobile home">
      <div className={styles.greeting}><p>GOOD TO SEE YOU</p><h1>{profile.name ? `Hi, ${profile.name.split(' ')[0]}.` : 'Welcome back.'}</h1><span>Fast, reliable deliveries and shopping.</span></div>
      <div className={styles.services} aria-label="Choose a service">
        <button className={styles.selectedService} onClick={() => book()}><Box aria-hidden /><span><strong>Collect &amp; Deliver</strong><small>Send anything, anywhere.</small></span></button>
        <button disabled={!shoppingEnabled} onClick={() => setShopping(true)}><ShoppingBag aria-hidden /><span><strong>Buy for Me</strong><small>{shoppingEnabled ? 'We shop for you.' : 'Coming soon'}</small></span></button>
      </div>
      <section className={styles.booking} aria-labelledby="booking-heading">
        <div className={styles.bookingHeading}><div><p>LET&apos;S GET STARTED</p><h2 id="booking-heading">Where are we delivering?</h2><span>Add your pickup and delivery addresses.</span></div><Box className={styles.parcel} aria-hidden /></div>
        <div className={styles.addresses}>
          <button onClick={() => book('pickup')}><MapPin aria-hidden /><span><strong>Pickup address</strong><small>Where should we collect from?</small></span><ChevronRight aria-hidden /></button>
          <button onClick={() => book('delivery')}><MapPin aria-hidden /><span><strong>Delivery address</strong><small>Where should we deliver to?</small></span><ChevronRight aria-hidden /></button>
        </div>
        <button className={styles.continue} onClick={() => book()}>Continue booking <ArrowRight size={20} aria-hidden /></button>
      </section>
      <Link className={styles.deliveries} href="/dashboard/customer/active-deliveries"><Truck aria-hidden /><span><strong>Your deliveries</strong><small>{deliveryLabel}</small></span><ChevronRight aria-hidden /></Link>
      <div className={styles.shortcuts}>
        <Link href="/dashboard/customer/wallet"><Wallet aria-hidden /><span><small>Wallet balance</small><strong>{walletLabel}</strong></span><ChevronRight aria-hidden /></Link>
        <Link href="/dashboard/customer/support"><CircleHelp aria-hidden /><span><strong>Get help</strong><small>Support &amp; FAQs</small></span><ChevronRight aria-hidden /></Link>
        <Link className={styles.saved} href="/dashboard/customer/addresses"><MapPin aria-hidden /><span><strong>Saved addresses</strong><small>Manage your addresses</small></span><ChevronRight aria-hidden /></Link>
      </div>
    </main>
    <nav className={styles.bottomNav} aria-label="Customer navigation">{nav.map(({ icon: Icon, ...item }) => <Link key={item.href} href={item.href} aria-current={item.label === 'Home' ? 'page' : undefined}><Icon size={22} aria-hidden /><span>{item.label}</span></Link>)}</nav>
    {shopping && <ShoppingModal onClose={() => setShopping(false)} />}
  </div>
}
