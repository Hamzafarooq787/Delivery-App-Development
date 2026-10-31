"use client";
import { useEffect } from 'react'
import { discardAbandonedBookingDrafts } from '@/lib/booking-draft-policy'

/** Each new form starts empty; discard recovery data left by older app versions. */
export function useFreshBookingForm(kind: 'delivery' | 'buy_for_me') {
  useEffect(() => {
    try { discardAbandonedBookingDrafts(sessionStorage, kind) }
    catch { /* Storage restrictions must not prevent booking. */ }
  }, [kind])
}
