import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { User, Camera } from "lucide-react"

export default function CustomerProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My Profile" description="Manage your personal information." />

      <div className="max-w-xl flex flex-col gap-5">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-5 mb-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center">
                <User className="h-10 w-10 text-muted-foreground" />
              </div>
              <button className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background">
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <div>
              <div className="h-5 w-32 rounded bg-secondary mb-2"></div>
              <div className="h-4 w-44 rounded bg-secondary"></div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">First Name</label>
                <input type="text" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" defaultValue="—" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Last Name</label>
                <input type="text" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" defaultValue="—" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Email</label>
              <input type="email" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" defaultValue="—" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Phone</label>
              <input type="tel" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" defaultValue="—" />
            </div>
            <Button size="sm">Save Changes</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
