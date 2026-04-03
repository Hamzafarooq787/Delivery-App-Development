import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Upload, CheckCircle, AlertCircle, FileText, User, Car, CreditCard } from "lucide-react"

const verificationItems = [
  { label: "Government ID", description: "Upload a valid photo ID", icon: User, status: "completed" as const },
  { label: "Driver's License", description: "Upload your valid driver's license", icon: FileText, status: "completed" as const },
  { label: "Vehicle Registration", description: "Upload vehicle registration document", icon: Car, status: "pending" as const },
  { label: "Insurance Certificate", description: "Upload valid vehicle insurance", icon: FileText, status: "pending" as const },
  { label: "Bank Details", description: "Add account for payout", icon: CreditCard, status: "unverified" as const },
]

export default function VerificationPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Verification" description="Complete your driver verification to start accepting jobs." />

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-2 bg-foreground rounded-full" style={{ width: "40%" }}></div>
          </div>
          <span className="text-xs font-medium text-foreground whitespace-nowrap">2 of 5 completed</span>
        </div>

        <div className="flex flex-col gap-4">
          {verificationItems.map((item) => (
            <div key={item.label} className="flex items-center gap-4 rounded-lg border border-border p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary shrink-0">
                <item.icon className="h-5 w-5 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={item.status === "completed" ? "verified" : item.status === "pending" ? "pending" : "unverified"} />
                {item.status !== "completed" && (
                  <Button size="sm" variant="outline">
                    <Upload className="h-3.5 w-3.5 mr-1.5" />Upload
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
