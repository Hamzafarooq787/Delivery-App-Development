/**
 * app/dashboard/layout.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared layout for all dashboard routes (/dashboard/customer, /driver, /admin).
 *
 * Responsibilities:
 *   • Forces dynamic rendering (Supabase session needed at request time)
 *   • Renders the NotificationPermission banner for authenticated users
 *     so push notification opt-in is surfaced after login
 */

import { createClient } from "@/lib/supabase/server"
import { NotificationPermission } from "@/components/pwa/notification-permission"

// All dashboard routes require authentication and live Supabase data.
// Force dynamic rendering so Next.js never statically prerenders them at
// build time — Supabase env vars are not available during the build step.
export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fetch the authenticated user's ID server-side.
  // The ID is passed to the client NotificationPermission component so it
  // can save the FCM token against the correct Supabase row.
  let userId: string | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch {
    // Silently ignore — notifications are non-critical
  }

  return (
    <>
      {children}
      {/* Non-intrusive notification permission banner — only shown when userId
          is available and permission hasn't been granted or dismissed yet */}
      <NotificationPermission userId={userId} />
    </>
  )
}
