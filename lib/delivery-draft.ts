/**
 * lib/delivery-draft.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Persists an in-progress "New Delivery" form across the Stripe wallet
 * top-up redirect. Stripe Checkout is a hosted page (full navigation away
 * from the app), so a literal zero-navigation "top up without leaving the
 * form" isn't possible — this is the next best thing: save the form, send
 * the customer to Stripe, and reopen the modal pre-filled the moment they
 * land back with funds in place.
 */

import type { PackageSize } from "@/lib/vehicles"

const STORAGE_KEY = "godrop_pending_delivery_draft"

export type DeliveryDraft = {
  pickupValue: string
  deliveryValue: string
  pickupCoords: { lat: number; lng: number } | null
  deliveryCoords: { lat: number; lng: number } | null
  selectedPayload: string
  packageSize: PackageSize | null
}

export function saveDeliveryDraft(draft: DeliveryDraft) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    /* private browsing / storage full — the resume flow degrades gracefully */
  }
}

export function loadDeliveryDraft(): DeliveryDraft | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DeliveryDraft) : null
  } catch {
    return null
  }
}

export function clearDeliveryDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
