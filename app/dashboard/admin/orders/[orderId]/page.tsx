import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { Timeline } from "@/components/shared/timeline"
import { ArrowLeft, MapPin, Package, User, Car } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { ResetDeliveryOtpButton } from "@/components/admin/reset-delivery-otp-button"
import { getDeliveryRatings } from "@/app/actions/ratings"
import { Star } from "lucide-react"

const OTP_RESETTABLE_STATUSES = ["accepted", "collected", "in_transit"]

const STATUS_ORDER = ["requested", "accepted", "collected", "in_transit", "delivered"]

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const supabase = await createClient()

  const { data: order, error } = await supabase
    .from("delivery_requests")
    .select("*")
    .eq("id", orderId)
    .single()

  if (error || !order) notFound()

  const [customerRes, driverRes, logsRes, ratingsRes] = await Promise.all([
    order.customer_id
      ? supabase.from("users").select("full_name, email, phone").eq("id", order.customer_id).single()
      : Promise.resolve({ data: null }),
    order.driver_id
      ? supabase.from("users").select("full_name, email").eq("id", order.driver_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("delivery_status_logs")
      .select("status, created_at")
      .eq("delivery_id", orderId)
      .order("created_at", { ascending: true }),
    getDeliveryRatings(orderId),
  ])

  const customer = customerRes.data
  const driver = driverRes.data
  const logs: { status: string; created_at: string }[] = logsRes.data ?? []
  const ratings = ratingsRes.data
  const customerRating = ratings.find((r) => r.rater_role === "customer")
  const driverRating = ratings.find((r) => r.rater_role === "driver")

  const currentIdx = STATUS_ORDER.indexOf(order.status)
  const timelineSteps = STATUS_ORDER.map((s, idx) => {
    const log = logs.find((l) => l.status === s)
    const status: "completed" | "active" | "upcoming" =
      idx < currentIdx ? "completed" : idx === currentIdx ? "active" : "upcoming"
    return {
      label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      status,
      time: log
        ? new Date(log.created_at).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : undefined,
    }
  })

  const displayStatus = order.status === "delivered" ? "completed" : order.status === "requested" ? "pending" : order.status

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/admin/orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title={order.tracking_number ?? `Order #${orderId.slice(0, 8)}`}
          description="Full order details and status history."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Package Details
                </CardTitle>
                <StatusBadge status={displayStatus as Parameters<typeof StatusBadge>[0]["status"]} />
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Item Description</p>
                <p className="font-medium">{order.item_description ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Declared Value</p>
                <p className="font-medium">
                  {order.item_value != null ? `$${Number(order.item_value).toFixed(2)}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Price</p>
                <p className="font-medium">
                  {order.price != null ? `£${Number(order.price).toFixed(2)}` : "—"}
                </p>
                {(order.surge_multiplier > 1 || order.discount_amount > 0) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Base £{Number(order.base_price ?? order.price).toFixed(2)}
                    {order.surge_multiplier > 1 && ` × ${order.surge_multiplier} surge`}
                    {order.discount_amount > 0 && ` − £${Number(order.discount_amount).toFixed(2)} discount`}
                    {order.promo_code && ` (${order.promo_code})`}
                  </p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">Tracking Number</p>
                <p className="font-medium font-mono text-xs">{order.tracking_number ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Safe Item Confirmed</p>
                <p className="font-medium">{order.is_safe_confirmed ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Created At</p>
                <p className="font-medium">
                  {new Date(order.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {order.item_photo_urls && order.item_photo_urls.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground mb-2">Item Photos</p>
                  <div className="flex flex-wrap gap-2">
                    {order.item_photo_urls.map((url: string) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="w-16 h-16 rounded-lg overflow-hidden border shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="Item" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {(order.parcel_image_url || order.delivered_image_url) && (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground mb-2">Proof Photos</p>
                  <div className="flex flex-wrap gap-3">
                    {order.parcel_image_url && (
                      <a href={order.parcel_image_url} target="_blank" rel="noreferrer" className="block">
                        <div className="w-24 h-24 rounded-lg overflow-hidden border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={order.parcel_image_url} alt="Parcel at pickup" className="w-full h-full object-cover" />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 text-center">Pickup</p>
                      </a>
                    )}
                    {order.delivered_image_url && (
                      <a href={order.delivered_image_url} target="_blank" rel="noreferrer" className="block">
                        <div className="w-24 h-24 rounded-lg overflow-hidden border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={order.delivered_image_url} alt="Delivered package" className="w-full h-full object-cover" />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 text-center">Delivery</p>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Route
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium">Pickup</p>
                <p>{order.pickup_address ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium">Dropoff</p>
                <p>{order.delivery_address ?? "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Order Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline steps={timelineSteps} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {customer ? (
                <>
                  <p className="font-medium">{customer.full_name}</p>
                  <p className="text-muted-foreground">{customer.email}</p>
                  {customer.phone && <p className="text-muted-foreground">{customer.phone}</p>}
                  <Link
                    href={`/dashboard/admin/customers/${order.customer_id}`}
                    className="text-xs text-primary hover:underline block pt-1"
                  >
                    View profile →
                  </Link>
                </>
              ) : (
                <p className="text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Car className="h-4 w-4" />
                Assigned Driver
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {driver ? (
                <>
                  <p className="font-medium">{driver.full_name}</p>
                  <p className="text-muted-foreground">{driver.email}</p>
                  <Link
                    href={`/dashboard/admin/drivers/${order.driver_id}`}
                    className="text-xs text-primary hover:underline block pt-1"
                  >
                    View driver →
                  </Link>
                </>
              ) : (
                <p className="text-muted-foreground">No driver assigned</p>
              )}
            </CardContent>
          </Card>

          {(customerRating || driverRating) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Ratings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {customerRating && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-muted-foreground text-xs">Customer rated driver</p>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                        customerRating.status === "approved" ? "bg-green-500/10 text-green-600" :
                        customerRating.status === "rejected" ? "bg-destructive/10 text-destructive" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {customerRating.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`h-3.5 w-3.5 ${n <= customerRating.score ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                    {customerRating.comment && <p className="text-xs text-muted-foreground mt-1">"{customerRating.comment}"</p>}
                  </div>
                )}
                {driverRating && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-muted-foreground text-xs">Driver rated customer</p>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                        driverRating.status === "approved" ? "bg-green-500/10 text-green-600" :
                        driverRating.status === "rejected" ? "bg-destructive/10 text-destructive" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {driverRating.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`h-3.5 w-3.5 ${n <= driverRating.score ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                    {driverRating.comment && <p className="text-xs text-muted-foreground mt-1">"{driverRating.comment}"</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Admin Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full" size="sm">
                Assign Driver
              </Button>
              <Button variant="outline" className="w-full" size="sm">
                Cancel Order
              </Button>
              <Button variant="outline" className="w-full" size="sm">
                Issue Refund
              </Button>
              {OTP_RESETTABLE_STATUSES.includes(order.status) && (
                <ResetDeliveryOtpButton deliveryId={order.id} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
