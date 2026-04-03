import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"

const settingsSections = [
  {
    title: "Notifications",
    settings: [
      { label: "Email notifications", description: "Receive updates via email", enabled: true },
      { label: "SMS notifications", description: "Receive updates via SMS", enabled: true },
      { label: "Push notifications", description: "Receive in-app notifications", enabled: false },
      { label: "Marketing emails", description: "Receive promotional offers", enabled: false },
    ],
  },
  {
    title: "Privacy",
    settings: [
      { label: "Share location data", description: "Allow location sharing for delivery", enabled: true },
      { label: "Analytics", description: "Help improve our service", enabled: true },
    ],
  },
]

export default function CustomerSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Manage your account preferences." />

      <div className="max-w-xl flex flex-col gap-5">
        {settingsSections.map((section) => (
          <div key={section.title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4">{section.title}</h2>
            <div className="flex flex-col gap-4">
              {section.settings.map((setting) => (
                <div key={setting.label} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{setting.label}</p>
                    <p className="text-xs text-muted-foreground">{setting.description}</p>
                  </div>
                  <button
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                      setting.enabled ? "bg-foreground" : "bg-secondary"
                    }`}
                    role="switch"
                    aria-checked={setting.enabled}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow transform transition-transform ${
                        setting.enabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">Danger Zone</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Delete Account</p>
              <p className="text-xs text-muted-foreground">Permanently remove your account and data.</p>
            </div>
            <Button variant="destructive" size="sm">Delete</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
