import { cn } from "@/lib/utils"

type Status =
  | "pending"
  | "active"
  | "in_transit"
  | "completed"
  | "cancelled"
  | "available"
  | "verified"
  | "unverified"
  | "paid"
  | "unpaid"
  | "open"
  | "resolved"

const statusConfig: Record<Status, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
  active: { label: "Active", className: "bg-green-100 text-green-800" },
  in_transit: { label: "In Transit", className: "bg-blue-100 text-blue-800" },
  completed: { label: "Completed", className: "bg-secondary text-secondary-foreground" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800" },
  available: { label: "Available", className: "bg-green-100 text-green-800" },
  verified: { label: "Verified", className: "bg-green-100 text-green-800" },
  unverified: { label: "Unverified", className: "bg-yellow-100 text-yellow-800" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800" },
  unpaid: { label: "Unpaid", className: "bg-red-100 text-red-800" },
  open: { label: "Open", className: "bg-yellow-100 text-yellow-800" },
  resolved: { label: "Resolved", className: "bg-secondary text-secondary-foreground" },
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: "bg-secondary text-secondary-foreground" }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
