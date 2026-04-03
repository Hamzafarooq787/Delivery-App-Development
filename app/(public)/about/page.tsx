export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 md:px-6">
      <div className="mb-12">
        <h1 className="text-3xl font-semibold text-foreground text-balance mb-4">About SwiftDeliver</h1>
        <p className="text-base text-muted-foreground text-pretty leading-relaxed max-w-2xl">
          We are a technology-driven delivery platform connecting customers with verified drivers for fast, safe, and affordable delivery services.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        {["Our Mission", "Our Vision", "Our Values", "Our Team"].map((section) => (
          <div key={section} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-3">{section}</h2>
            <div className="h-16 rounded-lg bg-secondary"></div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">Our Story</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 rounded bg-secondary" style={{ width: `${100 - i * 10}%` }}></div>
          ))}
        </div>
      </div>
    </div>
  )
}
