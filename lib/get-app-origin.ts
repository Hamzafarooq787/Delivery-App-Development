/**
 * lib/get-app-origin.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Resolves this app's own public origin for use in redirect URLs (Stripe
 * Checkout success/cancel, Supabase email confirmation / password reset).
 *
 * Must NEVER resolve to Supabase's project URL (*.supabase.co) — that's the
 * auth server's own domain, not a page in this app. Pointing a redirect at
 * it leaves the user stranded with an unexchanged `?code=` in the URL.
 *
 * Server-only (uses next/headers) — import from server actions / route
 * handlers, never from client components.
 */

import { headers } from "next/headers"

export async function getAppOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  return `${proto}://${host}`
}
