// All dashboard routes are authenticated and require real-time data.
// Force dynamic rendering so Next.js never tries to statically prerender them
// (Supabase env vars are not available at build time).
export const dynamic = "force-dynamic"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
