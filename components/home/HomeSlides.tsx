"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react"
import { ArrowLeft, ArrowRight, Box, Check, KeyRound, Menu, ShoppingBag, Truck, X } from "lucide-react"
import { clampSlide, INTERACTIVE_SELECTOR, isDoubleTap, SLIDE_COUNT, swipeDirection, wheelDirection } from "./slide-gestures"
import { BrandLogo } from '@/components/shared/brand-logo'
import styles from "./HomeSlides.module.css"

const names = ["Home", "Services", "How it works", "Buy for Me", "For business", "Help"]
const faqs = [
  ["What is GoDrop?", "GoDrop helps you arrange local collections and deliveries for parcels, forgotten items and everyday supplies."],
  ["What can I send?", "Parcels, gifts, keys and other permitted everyday items. Check our prohibited items page before booking."],
  ["How does Buy for Me work?", "Buy for Me is coming soon. Register your interest for personal shopping and delivery from local shops."],
  ["How much does delivery cost?", "Sign in and enter your booking details to review the available price before confirming."],
  ["Where is GoDrop available?", "Availability depends on your collection and delivery locations. Check when booking."],
]

export default function HomeSlides() {
  const [active, setActive] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const heading = useRef<Array<HTMLHeadingElement | null>>([])
  const lastMove = useRef(0)
  const pointer = useRef<{ id: number; x: number; y: number; time: number } | null>(null)
  const previousTap = useRef<{ time: number; x: number; y: number } | null>(null)

  const go = useCallback((value: number, focus = false) => {
    setActive(clampSlide(value))
    previousTap.current = null
    setMenuOpen(false)
    if (focus) requestAnimationFrame(() => heading.current[clampSlide(value)]?.focus({ preventScroll: true }))
  }, [])

  const move = useCallback((direction: number) => {
    if (Date.now() - lastMove.current < 650) return
    lastMove.current = Date.now()
    setActive(index => clampSlide(index + direction))
    previousTap.current = null
  }, [])

  useEffect(() => {
    const previousHtml = document.documentElement.style.overflow
    const previousBody = document.body.style.overflow
    document.documentElement.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
    return () => {
      document.documentElement.style.overflow = previousHtml
      document.body.style.overflow = previousBody
    }
  }, [])

  useEffect(() => {
    const element = root.current
    if (!element) return
    let total = 0
    let direction = 0
    let consumed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    function wheel(event: WheelEvent) {
      // Keep zoom, menus, forms and expanded FAQ content native.
      if (event.ctrlKey || menuOpen || (event.target instanceof Element && event.target.closest(INTERACTIVE_SELECTOR))) return
      const scrollable = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-slide-content]") : null
      if (scrollable && scrollable.scrollHeight > scrollable.clientHeight + 1 && Math.abs(event.deltaY) >= Math.abs(event.deltaX)) {
        const canScroll = event.deltaY > 0 ? scrollable.scrollTop + scrollable.clientHeight < scrollable.scrollHeight - 1 : scrollable.scrollTop > 1
        if (canScroll) return
      }
      event.preventDefault()
      clearTimeout(timer)
      timer = setTimeout(() => { total = 0; direction = 0; consumed = false }, 200)
      if (consumed) return
      const next = wheelDirection(event.deltaX, event.deltaY)
      if (next !== direction) total = 0
      direction = next
      total += Math.max(Math.abs(event.deltaX), Math.abs(event.deltaY)) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element!.clientHeight : 1)
      if (next && total >= 55) { consumed = true; move(next) }
    }
    element.addEventListener("wheel", wheel, { passive: false })
    return () => { element.removeEventListener("wheel", wheel); clearTimeout(timer) }
  }, [menuOpen, move])

  useEffect(() => {
    const element = root.current
    if (!element) return
    let start: { x: number; y: number; time: number; scrollable: HTMLElement | null } | null = null
    let nativeScroll = false
    function touchStart(event: TouchEvent) {
      start = null
      nativeScroll = false
      if (menuOpen || event.touches.length !== 1 || (event.target instanceof Element && event.target.closest(INTERACTIVE_SELECTOR))) return
      const touch = event.touches[0]
      start = { x: touch.clientX, y: touch.clientY, time: Date.now(), scrollable: event.target instanceof Element ? event.target.closest<HTMLElement>("[data-slide-content]") : null }
    }
    function touchMove(event: TouchEvent) {
      if (!start || event.touches.length !== 1) { start = null; previousTap.current = null; return }
      const touch = event.touches[0]
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      const content = start.scrollable
      if (Math.abs(dy) > Math.abs(dx) && content && content.scrollHeight > content.clientHeight + 1) {
        const canScroll = dy < 0 ? content.scrollTop + content.clientHeight < content.scrollHeight - 1 : content.scrollTop > 1
        if (canScroll || nativeScroll) { nativeScroll = true; previousTap.current = null; return }
      }
      // A non-passive listener keeps vertical gestures available to the slider
      // instead of the browser canceling Pointer Events during a touch pan.
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 8 && event.cancelable) event.preventDefault()
    }
    function touchEnd(event: TouchEvent) {
      const initial = start
      start = null
      if (!initial || nativeScroll || event.changedTouches.length !== 1 || event.touches.length) { previousTap.current = null; return }
      const touch = event.changedTouches[0]
      const dx = touch.clientX - initial.x
      const dy = touch.clientY - initial.y
      const direction = swipeDirection(dx, dy)
      if (direction) { previousTap.current = null; move(direction); return }
      if (Math.hypot(dx, dy) > 12 || Date.now() - initial.time > 500) { previousTap.current = null; return }
      const tap = { time: Date.now(), x: touch.clientX, y: touch.clientY }
      if (isDoubleTap(previousTap.current, tap)) { move(1); previousTap.current = null }
      else previousTap.current = tap
    }
    function touchCancel() { start = null; nativeScroll = false; previousTap.current = null }
    element.addEventListener("touchstart", touchStart, { passive: true })
    element.addEventListener("touchmove", touchMove, { passive: false })
    element.addEventListener("touchend", touchEnd, { passive: true })
    element.addEventListener("touchcancel", touchCancel, { passive: true })
    return () => {
      element.removeEventListener("touchstart", touchStart)
      element.removeEventListener("touchmove", touchMove)
      element.removeEventListener("touchend", touchEnd)
      element.removeEventListener("touchcancel", touchCancel)
    }
  }, [menuOpen, move])

  function startPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || !event.isPrimary || event.button !== 0 || menuOpen || (event.target instanceof Element && event.target.closest(INTERACTIVE_SELECTOR))) return
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: Date.now() }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function finishPointer(event: PointerEvent<HTMLDivElement>) {
    const start = pointer.current
    pointer.current = null
    if (!start || event.pointerId !== start.id) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const direction = swipeDirection(dx, dy)
    if (direction) { previousTap.current = null; move(direction); return }
    if (Math.hypot(dx, dy) > 12 || Date.now() - start.time > 500) { previousTap.current = null; return }
    const tap = { time: Date.now(), x: event.clientX, y: event.clientY }
    if (isDoubleTap(previousTap.current, tap)) { move(1); previousTap.current = null }
    else previousTap.current = tap
  }

  function slideTitle(index: number, text: React.ReactNode, hero = false) {
    return hero
      ? <h1 ref={node => { heading.current[index] = node }} tabIndex={-1}>{text}</h1>
      : <h2 ref={node => { heading.current[index] = node }} tabIndex={-1}>{text}</h2>
  }

  return (
    <div ref={root} className={styles.home} onPointerDown={startPointer} onPointerUp={finishPointer} onPointerCancel={() => { pointer.current = null; previousTap.current = null }}
      onKeyDown={event => {
        if (menuOpen || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof Element && event.target.closest(INTERACTIVE_SELECTOR))) return
        if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
          event.preventDefault()
          go(event.key === "Home" ? 0 : event.key === "End" ? SLIDE_COUNT - 1 : active + (event.key === "ArrowRight" ? 1 : -1), true)
        }
      }}>
      <header className={styles.header}>
        <button className={styles.logo} onClick={() => go(0, true)} aria-label="GoDrop home"><BrandLogo /></button>
        <nav aria-label="Homepage sections" className={styles.desktopNav}>
          {[1, 2, 3, 5].map(index => <button key={index} aria-current={active === index ? "page" : undefined} onClick={() => go(index, true)}>{names[index]}</button>)}
          <Link href="/signup?role=driver">For drivers</Link>
        </nav>
        <div className={styles.actions}><Link href="/login">Login</Link><Link className={styles.primary} href="/signup">Book a Delivery <ArrowRight size={17} aria-hidden /></Link></div>
        <button className={styles.menuButton} onClick={() => setMenuOpen(open => !open)} aria-expanded={menuOpen} aria-controls="home-menu" aria-label={menuOpen ? "Close menu" : "Open menu"}>{menuOpen ? <X /> : <Menu />}</button>
      </header>
      {menuOpen && <nav id="home-menu" aria-label="Mobile navigation" className={styles.mobileMenu}>{names.map((name, index) => <button key={name} onClick={() => go(index, true)}>{name}</button>)}<Link href="/login">Login</Link><Link href="/signup?role=driver">For drivers</Link></nav>}

      <div className={styles.viewport} role="region" aria-roledescription="carousel" aria-label="Explore GoDrop">
        <div className={styles.track} style={{ transform: `translateX(-${active * 100}%)` }}>
          {names.map((name, index) => <section key={name} className={`${styles.slide} ${index === 0 ? styles.heroSlide : ""}`} inert={active !== index} aria-hidden={active !== index} aria-label={`${index + 1} of ${SLIDE_COUNT}: ${name}`} aria-roledescription="slide">
            <div className={styles.content} data-slide-content>
              {index === 0 && <>
                <div className={styles.heroGrid}>
                  <div className={styles.heroCopy}><p className={styles.eyebrow}>Your day. Delivered.</p>{slideTitle(0, <>From here.<br />To there.<br /><em>We&apos;ll take it.</em></>, true)}<p className={styles.description}>Parcels, forgotten items and shopping.<br />Collected and delivered with GoDrop.</p><div className={styles.pills}><Link className={styles.primary} href="/signup"><Box size={18} aria-hidden /> Collect &amp; Deliver</Link><button onClick={() => go(3, true)}><ShoppingBag size={18} aria-hidden /> Buy for Me</button></div></div>
                  <div className={styles.heroImage}><Image src="/images/godrop-home-delivery.webp" alt="A delivery cyclist hands a parcel to a customer at her doorstep" fill preload draggable={false} sizes="(max-width: 767px) 100vw, 58vw" /><span>A little help for your everyday.</span></div>
                </div>
                <div className={styles.bookingTray}><h2>Where are we going?</h2><p>Sign in to enter your collection and delivery details.</p><Link className={styles.primary} href="/dashboard/customer">Start your booking <ArrowRight size={18} aria-hidden /></Link></div>
              </>}
              {index === 1 && <div className={styles.centered}>{slideTitle(1, <>What do you need <em>moved?</em></>)}<p className={styles.description}>One app. Everyday possibilities.</p><div className={styles.cards}>{[
                { Icon: Box, title: "Send a parcel", copy: "Documents, gifts, returns and everyday items.", button: "Send a parcel", href: "/signup" },
                { Icon: KeyRound, title: "Forgotten items", copy: "Keys, wallets and chargers. Arrange a collection.", button: "Arrange collection", href: "/signup" },
                { Icon: ShoppingBag, title: "Shop collection", copy: "Arrange pickup of something you have purchased.", button: "Book collection", href: "/signup" },
              ].map(({ Icon, title, copy, button, href }) => <article className={styles.card} key={title}><Icon className={styles.cardIcon} aria-hidden /><h3>{title}</h3><p>{copy}</p><Link className={styles.primary} href={href}>{button}<ArrowRight size={16} aria-hidden /></Link></article>)}</div></div>}
              {index === 2 && <div className={styles.centered}>{slideTitle(2, <>A few steps.<br /><em>A little less hassle.</em></>)}<ol className={styles.steps}>{[
                ["Choose a service", "Tell us what you need collected and delivered."], ["Add the details", "Enter the addresses and collection instructions."], ["Confirm booking", "Review the price and details before confirming."], ["Follow delivery", "Check your order progress in your GoDrop account."],
              ].map(([title, copy], step) => <li key={title}><span>{String(step + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ol><Link className={styles.primary} href="/how-it-works">Read the full guide <ArrowRight size={17} aria-hidden /></Link></div>}
              {index === 3 && <div className={styles.feature}><div><p className={styles.eyebrow}>Personal shopping · Coming soon</p>{slideTitle(3, <>Your shopping.<br /><em>Without the trip.</em></>)}<p className={styles.description}>We&apos;re working on Buy for Me: request items from a local shop and have them delivered to your door.</p><ul className={styles.checks}>{["Tell us the shop", "Add your shopping list", "Arrange collection and delivery"].map(text => <li key={text}><Check size={19} aria-hidden />{text}</li>)}</ul><Link href="/signup?service=buy_for_me" className={styles.primary}>Register interest <ArrowRight size={17} aria-hidden /></Link></div><ShoppingBag className={styles.featureIcon} strokeWidth={0.8} aria-hidden /></div>}
              {index === 4 && <div className={styles.feature}><div><p className={styles.eyebrow}>For business</p>{slideTitle(4, <>Local deliveries.<br /><em>For your business.</em></>)}<p className={styles.description}>Documents, parcels and everyday supplies. Arrange collections and deliveries around your working day.</p><ul className={styles.checks}>{["Simple booking", "Clear booking details", "Delivery updates and confirmation"].map(text => <li key={text}><Check size={19} aria-hidden />{text}</li>)}</ul><Link className={styles.primary} href="/contact">Discuss your delivery needs <ArrowRight size={17} aria-hidden /></Link></div><Truck className={styles.featureIcon} strokeWidth={0.8} aria-hidden /></div>}
              {index === 5 && <div className={styles.helpGrid}><div>{slideTitle(5, <>Here to <em>help.</em></>)}<div className={styles.faqs}>{faqs.map(([q, a]) => <details key={q}><summary>{q}<span aria-hidden>+</span></summary><p>{a}</p></details>)}</div></div><div className={styles.helpPanels}><article className={styles.card}><Truck className={styles.cardIcon} aria-hidden /><h3>Deliver for GoDrop</h3><p>Interested in joining as a driver? Create a driver account to get started.</p><Link href="/signup?role=driver" className={styles.primary}>Explore opportunities <ArrowRight size={16} aria-hidden /></Link></article><article className={styles.card}><h3>Need a hand?</h3><p>Talk to us about your collection or delivery.</p><Link href="/contact" className={styles.outline}>Contact us <ArrowRight size={16} aria-hidden /></Link></article><div className={styles.legal}><Link href="/privacy-policy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/safety">Safety</Link><Link href="/prohibited-items">Prohibited items</Link></div></div></div>}
            </div>
          </section>)}
        </div>
      </div>
      <footer className={styles.controls}>
        <button aria-label="Previous slide" disabled={active === 0} onClick={() => go(active - 1, true)}><ArrowLeft aria-hidden /></button>
        <div><p className={styles.gestureHint}>Scroll down: next · Scroll up: back · Swipe left / right · Double tap: next</p><span aria-live="polite" aria-atomic="true">{names[active]} <b>{String(active + 1).padStart(2, "0")} / {String(SLIDE_COUNT).padStart(2, "0")}</b></span></div>
        <button aria-label="Next slide" disabled={active === SLIDE_COUNT - 1} onClick={() => go(active + 1, true)}><ArrowRight aria-hidden /></button>
        <Link className={`${styles.primary} ${styles.mobileBooking}`} href="/signup">Book a Delivery <ArrowRight size={18} aria-hidden /></Link>
      </footer>
    </div>
  )
}
