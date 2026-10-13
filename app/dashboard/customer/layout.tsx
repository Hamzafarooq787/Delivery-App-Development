'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Sidebar from '@/components/customer/Sidebar'
import BottomNav from '@/components/customer/BottomNav'
import dynamic from 'next/dynamic'
import { loadDeliveryDraft, clearDeliveryDraft, type DeliveryDraft } from '@/lib/delivery-draft'

// Lazy-load so Google Maps SDK doesn't block layout hydration
const NewDeliveryModal = dynamic(() => import('@/components/customer/NewDeliveryModal'), { ssr: false })

export default function CustomerDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const isHome = usePathname() === '/dashboard/customer'
  const [focusAddress, setFocusAddress] = useState<'pickup' | 'delivery' | undefined>()
  const [showModal, setShowModal] = useState(false)
  const [resumeDraft, setResumeDraft] = useState<DeliveryDraft | null>(null)

  // The BottomNav FAB dispatches this event; individual pages can too.
  useEffect(() => {
    const open = (event: Event) => {
      const focus = (event as CustomEvent<{ focus?: string }>).detail?.focus
      setFocusAddress(focus === 'pickup' || focus === 'delivery' ? focus : undefined)
      setShowModal(true)
    }
    document.addEventListener('open-new-delivery', open)
    return () => document.removeEventListener('open-new-delivery', open)
  }, [])

  // Resume an in-progress delivery request after a wallet top-up redirect
  // from Stripe (see NewDeliveryModal's "Add Funds" flow). Reads the raw
  // query string directly instead of useSearchParams so this layout doesn't
  // need a Suspense boundary for it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('resume_delivery') !== '1') return

    const draft = loadDeliveryDraft()
    clearDeliveryDraft()

    // Strip the resume params from the URL without a full navigation
    params.delete('resume_delivery')
    params.delete('topup')
    const qs = params.toString()
    router.replace(`/dashboard/customer${qs ? `?${qs}` : ''}`)

    if (draft) {
      setResumeDraft(draft)
      setShowModal(true)
      toast.success('Funds added — continue your delivery request.', { duration: 6000 })
    }
  }, [router])

  return (
    <div className={isHome ? "bg-surface-container-low" : "min-h-screen bg-surface-container-low"}>
      {/* Top bar chrome comes from each page's own <Header /> — mounting
          CustomerTopBar here as well rendered two top bars at once. */}
      {!isHome && <><Sidebar /><BottomNav /></>}
      {children}
      {showModal && (
        <NewDeliveryModal
          initialDraft={resumeDraft}
          focusAddress={focusAddress}
          onClose={() => { setShowModal(false); setResumeDraft(null) }}
        />
      )}
    </div>
  )
}

