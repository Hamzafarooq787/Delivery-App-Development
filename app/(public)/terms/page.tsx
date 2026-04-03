export default function TermsPage() {
  const sections = [
    "Acceptance of Terms",
    "Description of Services",
    "User Accounts and Registration",
    "Prohibited Activities",
    "Payment Terms",
    "Cancellation Policy",
    "Limitation of Liability",
    "Privacy and Data Protection",
    "Changes to Terms",
    "Governing Law",
    "Contact Information",
  ]

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-foreground text-balance mb-3">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: January 1, 2025</p>
      </div>
      <div className="space-y-8">
        {sections.map((section, i) => (
          <div key={section} className="border-b border-border pb-8 last:border-0">
            <h2 className="text-base font-semibold text-foreground mb-3">
              {i + 1}. {section}
            </h2>
            <div className="space-y-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-3.5 rounded bg-secondary" style={{ width: `${95 - j * 5}%` }}></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
