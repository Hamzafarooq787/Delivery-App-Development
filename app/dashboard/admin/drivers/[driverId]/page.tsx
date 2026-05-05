import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { ArrowLeft, User, Car, FileText, DollarSign } from "lucide-react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { adminApproveDriver, adminRejectDriver, adminGetDriverById } from "@/app/actions/delivery"

export default async function AdminDriverDetailPage({
  params,
}: {
  params: Promise<{ driverId: string }>
}) {
  const { driverId } = await params
  const { data: driver, error } = await adminGetDriverById(driverId)

  if (error || !driver) notFound()

  const badgeStatus =
    driver.status === "approved" ? "verified" : driver.status === "rejected" ? "cancelled" : "pending"

  async function approve() {
    "use server"
    await adminApproveDriver(driverId)
    redirect(`/dashboard/admin/drivers/${driverId}`)
  }

  async function reject() {
    "use server"
    await adminRejectDriver(driverId)
    redirect(`/dashboard/admin/drivers/${driverId}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/admin/drivers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title={driver.full_name}
          description="Driver profile, documents, and job history."
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
                <p className="font-medium">{driver.full_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium">{driver.email || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{driver.phone ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Joined</p>
                <p className="font-medium">
                  {new Date(driver.created_at).toLocaleDateString("en-US", {
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
                <Car className="h-4 w-4" />
                Vehicle
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {["Type", "Make & Model", "Year", "Registration", "Insurance Expiry", "MOT Expiry"].map(
                (label) => (
                  <div key={label}>
                    <p className="text-muted-foreground">{label}</p>
                    <p className="font-medium text-muted-foreground/50">—</p>
                  </div>
                )
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">Document</th>
                      <th className="text-left py-2 pr-4 font-medium">Status</th>
                      <th className="text-left py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["Driving Licence", "Insurance", "MOT Certificate", "Profile Photo"].map((doc) => (
                      <tr key={doc} className="border-b last:border-0">
                        <td className="py-3 pr-4">{doc}</td>
                        <td className="py-3 pr-4">
                          <StatusBadge status="pending" />
                        </td>
                        <td className="py-3">
                          <Button variant="ghost" size="sm">
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Verification Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <StatusBadge status={badgeStatus} />
              <div className="space-y-2 pt-2">
                <form action={approve}>
                  <Button className="w-full" size="sm" type="submit" disabled={driver.status === "approved"}>
                    Approve Driver
                  </Button>
                </form>
                <form action={reject}>
                  <Button variant="outline" className="w-full" size="sm" type="submit" disabled={driver.status === "rejected"}>
                    Reject
                  </Button>
                </form>
                <Button variant="outline" className="w-full" size="sm">
                  Suspend Account
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Earnings Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Earned</span>
                <span className="font-medium">${driver.totalEarned.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jobs Completed</span>
                <span className="font-medium">{driver.jobsCompleted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Average Rating</span>
                <span className="font-medium text-muted-foreground/50">—</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending Payout</span>
                <span className="font-medium text-muted-foreground/50">—</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
