"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
/** Tab-local, account-scoped recovery. Quotes are always recalculated after restoration. */
export function useBookingDraft<T>(
  kind: string,
  value: T,
  restore: (value: T) => void,
) {
  const [key, setKey] = useState<string | null>(null);
  const restoreRef = useRef(restore);
  useEffect(() => {
    let active = true;
    void createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (!active || !user) return;
        const storageKey = `godrop-booking:${user.id}:${kind}`;
        try {
          const raw = sessionStorage.getItem(storageKey);
          if (raw) {
            const saved = JSON.parse(raw);
            if (saved.expires > Date.now()) restoreRef.current(saved.value);
            else sessionStorage.removeItem(storageKey);
          }
        } catch {
          /* Storage unavailable; the form remains usable. */
        }
        setKey(storageKey);
      });
    return () => {
      active = false;
    };
  }, [kind]);
  function persistNow() {
    if (key)
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({ expires: Date.now() + 86400000, value }),
        );
      } catch {
        /* Keep current form. */
      }
  }
  useEffect(() => {
    persistNow();
  }, [key, value]);
  return persistNow;
}
