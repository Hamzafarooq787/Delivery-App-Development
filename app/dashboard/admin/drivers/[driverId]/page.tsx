import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { ArrowLeft, User, Car, FileText, DollarSign } from "lucide-react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { adminApproveDriver, adminRejectDriver, adminGetDriverById } from "@/app/actions/delivery"
import { getDriverDocumentsById } from "@/app/actions/documents"

const DOC_LABELS: Record<string, string> = {
  identity: "Identity / Driving Licence",
  insurance: "Insurance Policy",
  vehicle_registration: "Vehicle Registration",
}

export default async function AdminDriverDetailPage({
  params,
}: {
  params: Promise<{ driverId: string }>
}) {
  const { driverId } = await params
  const [{ data: driver, error }, documents] = await Promise.all([
    adminGetDriverById(driverId),
    getDriverDocumentsById(driverId),
  ])

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
          {/* Profile */}
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
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Submitted Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No documents uploaded yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-4 font-medium">Document</th>
                        <th className="text-left py-2 pr-4 font-medium">Uploaded</th>
                        <th className="text-left py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => (
                        <tr key={doc.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-medium">
                            {DOC_LABELS[doc.document_type] ?? doc.document_type}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground text-xs">
                            {new Date(doc.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3">
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              View / Download
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Document type checklist */}
              {documents.length > 0 && (
                <div className="mt-4 pt-4 border-t flex flex-wrap gap-3">
                  {["identity", "insurance", "vehicle_registration"].map((type) => {
                    const uploaded = documents.some((d) => d.document_type === type)
                    return (
                      <div
                        key={type}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium ${
                          uploaded
                            ? "bg-green-500/10 text-green-600"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <span className="text-base leading-none">{uploaded ? "✓" : "○"}</span>
                        {DOC_LABELS[type]}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vehicle */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Car className="h-4 w-4" />
                Vehicle
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {["Type", "Make & Model", "Year", "Registration"].map((label) => (
                <div key={label}>
                  <p className="text-muted-foreground">{label}</p>
                  <p className="font-medium text-muted-foreground/50">—</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Verification Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Verification Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <StatusBadge status={badgeStatus} />
              {documents.length === 0 && (
                <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                  Driver has not uploaded any documents yet.
                </p>
              )}
              <div className="space-y-2 pt-2">
                <form action={approve}>
                  <Button
                    className="w-full"
                    size="sm"
                    type="submit"
                    disabled={driver.status === "approved"}
                  >
                    Approve Driver
                  </Button>
                </form>
                <form action={reject}>
                  <Button
                    variant="outline"
                    className="w-full"
                    size="sm"
                    type="submit"
                    disabled={driver.status === "rejected"}
                  >
                    Reject
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>

          {/* Earnings */}
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
