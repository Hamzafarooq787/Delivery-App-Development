const sections = [
  {
    title: "Our Mission",
    content:
      "To make local delivery as simple as requesting a ride — fast, transparent, and reliable for everyone involved.",
  },
  {
    title: "Our Vision",
    content:
      "A world where any package can reach its destination within hours, driven by a community of trusted, well-compensated drivers.",
  },
  {
    title: "Our Values",
    content:
      "Safety, transparency, and fairness guide every decision we make — from how we verify drivers to how we price deliveries.",
  },
  {
    title: "Our Team",
    content:
      "We are a team of logistics, technology, and community-building experts passionate about transforming last-mile delivery.",
  },
]

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 md:px-6">
      <div className="mb-12">
        <h1 className="text-3xl font-semibold text-foreground text-balance mb-4">About SwiftDeliver</h1>
        <p className="text-base text-muted-foreground text-pretty leading-relaxed max-w-2xl">
          We are a technology-driven delivery platform connecting customers with verified drivers for fast, safe, and affordable delivery services.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
        {sections.map((section) => (
          <div key={section.title} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-3">{section.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">Our Story</h2>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            SwiftDeliver was founded after our founder struggled to find a reliable same-day delivery service for a small business order. The experience was frustrating — existing couriers were slow, opaque, and expensive.
          </p>
          <p>
            We set out to build something better: a platform where customers get real-time visibility, drivers earn fair pay, and every delivery is handled with care. Starting with a small pilot in one city, we have grown to serve thousands of customers and hundreds of drivers across multiple regions.
          </p>
          <p>
            Today, SwiftDeliver powers deliveries for individuals, small businesses, and enterprises — all through a simple, transparent platform built on trust.
          </p>
        </div>
      </div>
    </div>
  )
}
