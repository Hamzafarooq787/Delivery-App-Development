'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/customer/Sidebar'
import BottomNav from '@/components/customer/BottomNav'
import dynamic from 'next/dynamic'

// Lazy-load so Google Maps SDK doesn't block layout hydration
const NewDeliveryModal = dynamic(() => import('@/components/customer/NewDeliveryModal'), { ssr: false })

export default function CustomerDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [showModal, setShowModal] = useState(false)

  // The BottomNav FAB dispatches this event; individual pages can too.
  useEffect(() => {
    const open = () => setShowModal(true)
    document.addEventListener('open-new-delivery', open)
    return () => document.removeEventListener('open-new-delivery', open)
  }, [])

  return (
    <div className="min-h-screen bg-surface-container-low">
      <Sidebar />
      <BottomNav />
      {children}
      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
