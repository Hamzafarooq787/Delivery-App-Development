'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

const Selection = createContext<{
  deliveryId: string | null
  selectDelivery: (id: string | null) => void
}>({ deliveryId: null, selectDelivery: () => {} })

export function DriverTrackingSelection({ children }: { children: ReactNode }) {
  const [deliveryId, selectDelivery] = useState<string | null>(null)
  const value = useMemo(() => ({ deliveryId, selectDelivery }), [deliveryId])
  return <Selection.Provider value={value}>{children}</Selection.Provider>
}

export function useDriverTrackingSelection() {
  return useContext(Selection)
}
