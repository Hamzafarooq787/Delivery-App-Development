import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"

const STATUS_COLORS: Record<string, string> = {
  requested:  "bg-[var(--brand-strong)]/10 text-[var(--brand-soft)]",
  accepted:   "bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]",
  collected:  "bg-blue-500/10 text-blue-400",
  in_transit: "bg-amber-500/10 text-amber-400",
  delivered:  "bg-emerald-500/10 text-emerald-400",
  cancelled:  "bg-red-500/10 text-red-400",
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = await params
  const admin = createAdminClient()

  const { data: customer, error } = await admin
    .from("users")
    .select("id, full_name, phone, created_at, marketing_email_opt_in, marketing_push_opt_in")
    .eq("id", customerId)
    .single()

  if (error || !customer) notFound()

  const [ordersRes, disputeRes, authUserRes] = await Promise.all([
    admin
      .from("delivery_requests")
      .select("id, tracking_number, status, price, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    admin
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", customerId)
      .eq("status", "open"),
    admin.auth.admin.getUserById(customerId),
  ])

  const orders = ordersRes.data ?? []
  const openDisputes = disputeRes.count ?? 0
  const totalSpent = orders.reduce((sum, o) => sum + (o.price ?? 0), 0)
  const email = authUserRes.data.user?.email ?? null
  const lastActive = orders[0]?.created_at ?? customer.created_at

  const initials = (customer.full_name ?? email ?? "?").slice(0, 2).toUpperCase()

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[var(--brand-bg)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <Link
          href="/dashboard/admin/customers"
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 hover:bg-[var(--color-surface-container-highest)] transition-colors"
        >
          <span className="material-symbols-outlined text-[var(--color-on-surface-variant)] text-sm">arrow_back</span>
        </Link>
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold font-headline tracking-tight text-white">
            {customer.full_name}
          </h2>
          <p className="text-[var(--color-on-surface-variant)] mt-0.5 text-sm">Customer profile and order history.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6">
        {/* Main column */}
        <div className="lg:col-span-8 space-y-5">

          {/* Profile */}
          <div className="bg-[var(--brand-panel)]/60 backdrop-blur-xl border border-[var(--color-outline-variant)]/15 rounded-xl p-5 md:p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-[var(--brand-strong)]/10 flex items-center justify-center text-[var(--brand-soft)] text-lg font-bold shrink-0">
                {initials}
              </div>
              <div>
                <p className="text-white font-bold text-lg">{customer.full_name}</p>
                <p className="text-[var(--color-on-surface-variant)] text-sm">{email ?? "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Phone</p>
                <p className="text-white">{customer.phone ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Joined</p>
                <p className="text-white">
                  {new Date(customer.created_at).toLocaleDateString("en-US", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Email Consent</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${customer.marketing_email_opt_in ? "bg-emerald-500/10 text-emerald-400" : "bg-[var(--color-outline-variant)]/20 text-[var(--color-on-surface-variant)]"}`}>
                  {customer.marketing_email_opt_in ? "Opted in" : "Opted out"}
                </span>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Push Consent</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${customer.marketing_push_opt_in ? "bg-emerald-500/10 text-emerald-400" : "bg-[var(--color-outline-variant)]/20 text-[var(--color-on-surface-variant)]"}`}>
                  {customer.marketing_push_opt_in ? "Opted in" : "Opted out"}
                </span>
              </div>
            </div>
          </div>

          {/* Order History */}
          <div className="bg-[var(--brand-panel)]/60 backdrop-blur-xl border border-[var(--color-outline-variant)]/15 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 md:px-6 py-4 border-b border-[var(--color-outline-variant)]/10">
              <span className="material-symbols-outlined text-[var(--brand-soft)] text-lg">local_shipping</span>
              <h3 className="text-base font-bold text-white font-headline">Order History</h3>
              <span className="ml-auto text-xs text-[var(--color-on-surface-variant)] bg-[var(--color-outline-variant)]/20 px-2 py-0.5 rounded-full">
                {orders.length} orders
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[480px]">
                <thead>
                  <tr className="bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-6 py-4">Order ID</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-outline-variant)]/5">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-[var(--color-on-surface-variant)] text-sm">
                        No orders yet
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id} className="hover:bg-[var(--color-surface-container-high)] transition-colors">
                        <td className="px-6 py-4 font-mono text-xs">
                          <Link
                            href={`/dashboard/admin/orders/${o.id}`}
                            className="text-[var(--brand-soft)] hover:underline"
                          >
                            {o.tracking_number ?? o.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-[var(--color-on-surface-variant)] text-sm">
                          {new Date(o.created_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[o.status] ?? "bg-[var(--color-outline-variant)]/20 text-[var(--color-on-surface-variant)]"}`}>
                            {o.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-white font-semibold text-sm">
                          {o.price != null ? `£${Number(o.price).toFixed(2)}` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-4">

          {/* Stats */}
          <div className="bg-[var(--brand-panel)]/60 backdrop-blur-xl border border-[var(--color-outline-variant)]/15 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[var(--brand-soft)] text-lg">bar_chart</span>
              <h3 className="text-sm font-bold text-white font-headline">Stats</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: "Total Orders",  value: orders.length.toString() },
                { label: "Total Spent",   value: `£${totalSpent.toFixed(2)}` },
                { label: "Open Disputes", value: openDisputes.toString() },
                { label: "Last Active",   value: new Date(lastActive).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-[var(--color-on-surface-variant)] text-xs">{label}</span>
                  <span className="text-white text-sm font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Account Actions */}
          <div className="bg-[var(--brand-panel)]/60 backdrop-blur-xl border border-[var(--color-outline-variant)]/15 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[var(--brand-soft)] text-lg">manage_accounts</span>
              <h3 className="text-sm font-bold text-white font-headline">Account Actions</h3>
            </div>
            <div className="space-y-2">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-surface-container-high)] text-white rounded-lg text-sm border border-[var(--color-outline-variant)]/10 hover:bg-[var(--color-surface-container-highest)] transition-all">
                <span className="material-symbols-outlined text-sm text-[var(--brand-soft)]">mail</span>
                Send Message
              </button>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-surface-container-high)] text-white rounded-lg text-sm border border-[var(--color-outline-variant)]/10 hover:bg-[var(--color-surface-container-highest)] transition-all">
                <span className="material-symbols-outlined text-sm text-amber-400">block</span>
                Suspend Account
              </button>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-surface-container-high)] text-red-400 rounded-lg text-sm border border-red-500/10 hover:bg-red-500/5 transition-all">
                <span className="material-symbols-outlined text-sm">delete</span>
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

