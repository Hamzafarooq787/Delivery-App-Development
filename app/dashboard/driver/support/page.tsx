import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { LiveChat } from "@/components/driver/LiveChat"
import { MessageSquare, Plus } from "lucide-react"

const tickets = [
  { id: "TKT-001", subject: "—", status: "open" as const, date: "—" },
  { id: "TKT-002", subject: "—", status: "resolved" as const, date: "—" },
]

export default function DriverSupportPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Support" description="Get help with your driver account.">
        <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />New Ticket</Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
            <MessageSquare className="h-4 w-4 text-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Driver FAQs</h3>
          <p className="text-sm text-muted-foreground leading-relaxed flex-1">Common questions about deliveries, payouts, and verification.</p>
          <Button variant="outline" size="sm">Browse FAQs</Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
            <MessageSquare className="h-4 w-4 text-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Live Chat</h3>
          <p className="text-sm text-muted-foreground leading-relaxed flex-1">Connect with our AI-powered driver support assistant instantly.</p>
          <LiveChat />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
            <MessageSquare className="h-4 w-4 text-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Call Support</h3>
          <p className="text-sm text-muted-foreground leading-relaxed flex-1">Speak to a driver support representative.</p>
          <Button variant="outline" size="sm">Call Now</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">My Tickets</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Ticket ID</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Subject</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono text-foreground">{t.id}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{t.subject}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={t.status} /></td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{t.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
