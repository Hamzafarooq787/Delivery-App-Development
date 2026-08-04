import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { ArrowLeft, User, Package } from "lucide-react"
import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"

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

  const statusMap: Record<string, Parameters<typeof StatusBadge>[0]["status"]> = {
    delivered: "completed",
    requested: "pending",
    cancelled: "cancelled",
    in_transit: "in_transit",
    accepted: "active",
    collected: "active",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/admin/customers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title={customer.full_name}
          description="Customer profile and order history."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Full Name</p>
                <p className="font-medium">{customer.full_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium">{email ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{customer.phone ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Joined</p>
                <p className="font-medium">
                  {new Date(customer.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">City</p>
                <p className="font-medium text-muted-foreground/50">—</p>
              </div>
              <div>
                <p className="text-muted-foreground">Postcode</p>
                <p className="font-medium text-muted-foreground/50">—</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Order History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">Order ID</th>
                      <th className="text-left py-2 pr-4 font-medium">Date</th>
                      <th className="text-left py-2 pr-4 font-medium">Status</th>
                      <th className="text-left py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-muted-foreground">
                          No orders yet
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-3 pr-4 font-mono text-xs">
                            <Link
                              href={`/dashboard/admin/orders/${o.id}`}
                              className="text-primary hover:underline"
                            >
                              {o.tracking_number ?? o.id.slice(0, 8)}
                            </Link>
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {new Date(o.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge status={statusMap[o.status] ?? "pending"} />
                          </td>
                          <td className="py-3">
                            {o.price != null ? `$${Number(o.price).toFixed(2)}` : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Account Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full" size="sm">
                Send Message
              </Button>
              <Button variant="outline" className="w-full" size="sm">
                Suspend Account
              </Button>
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
                size="sm"
              >
                Delete Account
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Orders</span>
                <span className="font-medium">{orders.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Spent</span>
                <span className="font-medium">${totalSpent.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Open Disputes</span>
                <span className="font-medium">{openDisputes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Active</span>
                <span className="font-medium">
                  {new Date(lastActive).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Marketing Consent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className={`font-medium ${customer.marketing_email_opt_in ? "text-primary" : "text-muted-foreground/60"}`}>
                  {customer.marketing_email_opt_in ? "Opted in" : "Opted out"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Push</span>
                <span className={`font-medium ${customer.marketing_push_opt_in ? "text-primary" : "text-muted-foreground/60"}`}>
                  {customer.marketing_push_opt_in ? "Opted in" : "Opted out"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
