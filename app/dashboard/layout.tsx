// All dashboard routes require authentication and live Supabase data.
// Force dynamic rendering so Next.js never statically prerenders them at
// build time — Supabase env vars are not available during the build step.
export const dynamic = "force-dynamic"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
