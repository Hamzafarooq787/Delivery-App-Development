"use client";
import { useEffect } from "react";
import { discardAbandonedBookingDrafts } from "@/lib/booking-draft-policy";
export function ClearCompletedBookingDraft({ kind }: { kind: string }) {
  useEffect(() => {
    try {
      discardAbandonedBookingDrafts(sessionStorage, kind === 'buy_for_me' ? 'buy_for_me' : 'delivery');
    } catch { /* Storage may be unavailable in private browsing. */ }
  }, [kind]);
  return null;
}
