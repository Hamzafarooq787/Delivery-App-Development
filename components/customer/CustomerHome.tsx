'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  Box,
  ShoppingBag,
  MapPin,
  ArrowRight,
  ChevronRight,
  Truck,
  Wallet,
  CircleHelp,
} from 'lucide-react'
import { useCustomerLiveRefresh } from '@/hooks/use-customer-live-refresh'
import { getCustomerHomeSnapshot } from '@/app/actions/customer-repairs'
import type { CustomerHomeData } from '@/lib/customer-home-data'
import { useVisibleViewport } from '@/hooks/use-visible-viewport'
import { ServiceIllustration } from './ServiceIllustration'
import styles from './CustomerHome.module.css'
import { CustomerHeader, CustomerBottomNavigation } from './CustomerNavigation'
import navStyles from './CustomerNavigation.module.css'
const loadShoppingModal = () => import('./NewShoppingRequestModal').then((m) => m.NewShoppingRequestModal)
function preloadShoppingModal() { void loadShoppingModal().catch(() => {}) }
const ShoppingModal = dynamic(
  loadShoppingModal,
  { ssr: false },
)

export default function CustomerHome({ initialData }: { initialData: CustomerHomeData }) {
  const screenRef = useVisibleViewport()
  const [snapshot,setSnapshot]=useState(initialData)
  const { profile, balance, delivery, loadError, shoppingEnabled } = snapshot
  useCustomerLiveRefresh(async()=>{const data=await getCustomerHomeSnapshot();if(data&&!data.loadError)setSnapshot(data)},'delivery_requests,wallet_balances,users')
  useEffect(()=>setSnapshot(initialData),[initialData])
  const [shopping, setShopping] = useState(false)
  // Layout owns the modal and draft-resume flow. A single event opens it once.
  function book(focus?: 'pickup' | 'delivery') {
    document.dispatchEvent(
      new CustomEvent('open-new-delivery', { detail: { focus } }),
    )
  }
  const deliveryLabel = loadError
      ? 'View your deliveries'
      : delivery
        ? `${delivery.tracking_number || 'Active delivery'} · ${(delivery.status || 'requested').replaceAll('_', ' ')}`
        : 'No deliveries yet.'
  const walletLabel =
    balance === null
      ? '—'
      : `${balance < 0 ? '-' : ''}£${Math.abs(balance).toFixed(2)}`
  return (
    <div ref={screenRef} className={`${styles.screen} ${navStyles.scope}`}>
      <CustomerHeader profile={profile} />
      <main className={styles.desktopMain} aria-label="Customer desktop home">
        <div className={styles.desktopGreeting}>
          <p>GOOD TO SEE YOU</p>
          <h1>
            {profile.name
              ? `Hi, ${profile.name.split(' ')[0]}.`
              : 'Welcome back.'}
          </h1>
          <h2>What do you need today?</h2>
          <span>Fast, reliable deliveries and shopping, all in one place.</span>
        </div>
        <div className={styles.desktopServices}>
          <section
            className={`${styles.serviceCard} ${styles.deliveryCard}`}
            aria-labelledby="collect-heading"
          >
            <div className={styles.serviceIcon}>
              <Box size={27} aria-hidden />
            </div>
            <div className={styles.serviceCopy}>
              <h3 id="collect-heading">Collect &amp; Deliver</h3>
              <p>
                Send anything, anywhere. We collect from you and deliver it
                safely.
              </p>
              <button onClick={() => book()}>
                Book a delivery <ArrowRight size={18} aria-hidden />
              </button>
            </div>
            <div className={styles.serviceArt}>
              <ServiceIllustration kind="parcel" />
            </div>
          </section>
          <section
            className={styles.serviceCard}
            aria-labelledby="shopping-heading"
          >
            <div className={styles.serviceIcon}>
              <ShoppingBag size={27} aria-hidden />
            </div>
            {shoppingEnabled === false && (
              <span className={styles.comingSoon}>Temporarily unavailable</span>
            )}
            <div className={styles.serviceCopy}>
              <h3 id="shopping-heading">Buy for Me</h3>
              <p>
                We shop for it, so you don&apos;t have to. Tell us what you need
                and we&apos;ll take care of the rest.
              </p>
              {shoppingEnabled !== false && (
                <button
                  className={styles.shoppingButton}
                  onPointerEnter={preloadShoppingModal}
                  onFocus={preloadShoppingModal}
                  onClick={() => setShopping(true)}
                >
                  Start shopping <ArrowRight size={18} aria-hidden />
                </button>
              )}
            </div>
            <div className={`${styles.serviceArt} ${styles.bagArt}`}>
              <ServiceIllustration kind="shopping" />
            </div>
          </section>
        </div>
        <Link
          className={styles.desktopDeliveries}
          href="/dashboard/customer/active-deliveries"
        >
          <span className={styles.shortcutIcon}>
            <Truck aria-hidden />
          </span>
          <span>
            <strong>Your deliveries</strong>
            <small>
              {deliveryLabel}
              {!loadError && !delivery && (
                <>
                  <br />
                  Book your first delivery to get started.
                </>
              )}
            </small>
          </span>
          <ChevronRight size={20} aria-hidden />
        </Link>
        <div className={styles.desktopShortcuts}>
          <Link href="/dashboard/customer/wallet">
            <span className={styles.shortcutIcon}>
              <Wallet aria-hidden />
            </span>
            <span>
              <small>Wallet balance</small>
              <strong>{walletLabel}</strong>
            </span>
            <ChevronRight size={18} aria-hidden />
          </Link>
          <Link href="/dashboard/customer/addresses">
            <span className={styles.shortcutIcon}>
              <MapPin aria-hidden />
            </span>
            <span>
              <strong>Saved addresses</strong>
              <small>Manage your pickup and delivery addresses.</small>
            </span>
            <ChevronRight size={18} aria-hidden />
          </Link>
          <Link href="/dashboard/customer/support">
            <span className={styles.shortcutIcon}>
              <CircleHelp aria-hidden />
            </span>
            <span>
              <strong>Get help</strong>
              <small>Support, FAQs and live chat.</small>
            </span>
            <ChevronRight size={18} aria-hidden />
          </Link>
        </div>
      </main>
      <main className={styles.main} aria-label="Customer mobile home">
        <div className={styles.greeting}>
          <p>GOOD TO SEE YOU</p>
          <h1>
            {profile.name
              ? `Hi, ${profile.name.split(' ')[0]}.`
              : 'Welcome back.'}
          </h1>
          <span>Fast, reliable deliveries and shopping.</span>
        </div>
        <div className={styles.services} aria-label="Choose a service">
          <button className={styles.selectedService} onClick={() => book()}>
            <Box aria-hidden />
            <span>
              <strong>Collect &amp; Deliver</strong>
              <small>Send anything, anywhere.</small>
            </span>
          </button>
          <button onPointerEnter={preloadShoppingModal} onFocus={preloadShoppingModal} disabled={shoppingEnabled === false} onClick={() => setShopping(true)}>
            <ShoppingBag aria-hidden />
            <span>
              <strong>Buy for Me</strong>
              <small>
                {shoppingEnabled === false ? 'Temporarily unavailable' : 'We shop for you.'}
              </small>
            </span>
          </button>
        </div>
        <section className={styles.booking} aria-labelledby="booking-heading">
          <div className={styles.bookingHeading}>
            <div>
              <p>LET&apos;S GET STARTED</p>
              <h2 id="booking-heading">Where are we delivering?</h2>
              <span>Add your pickup and delivery addresses.</span>
            </div>
            <Box className={styles.parcel} aria-hidden />
          </div>
          <div className={styles.addresses}>
            <button onClick={() => book('pickup')}>
              <MapPin aria-hidden />
              <span>
                <strong>Pickup address</strong>
                <small>Where should we collect from?</small>
              </span>
              <ChevronRight aria-hidden />
            </button>
            <button onClick={() => book('delivery')}>
              <MapPin aria-hidden />
              <span>
                <strong>Delivery address</strong>
                <small>Where should we deliver to?</small>
              </span>
              <ChevronRight aria-hidden />
            </button>
          </div>
          <button className={styles.continue} onClick={() => book()}>
            Continue booking <ArrowRight size={20} aria-hidden />
          </button>
        </section>
        <Link
          className={styles.deliveries}
          href="/dashboard/customer/active-deliveries"
        >
          <Truck aria-hidden />
          <span>
            <strong>Your deliveries</strong>
            <small>{deliveryLabel}</small>
          </span>
          <ChevronRight aria-hidden />
        </Link>
        <div className={styles.shortcuts}>
          <Link href="/dashboard/customer/wallet">
            <Wallet aria-hidden />
            <span>
              <small>Wallet balance</small>
              <strong>{walletLabel}</strong>
            </span>
            <ChevronRight aria-hidden />
          </Link>
          <Link href="/dashboard/customer/support">
            <CircleHelp aria-hidden />
            <span>
              <strong>Get help</strong>
              <small>Support &amp; FAQs</small>
            </span>
            <ChevronRight aria-hidden />
          </Link>
          <Link className={styles.saved} href="/dashboard/customer/addresses">
            <MapPin aria-hidden />
            <span>
              <strong>Saved addresses</strong>
              <small>Manage your addresses</small>
            </span>
            <ChevronRight aria-hidden />
          </Link>
        </div>
      </main>
      <CustomerBottomNavigation />
      {shopping && <ShoppingModal onClose={() => setShopping(false)} />}
    </div>
  )
}
