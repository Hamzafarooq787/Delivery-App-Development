import Link from "next/link"
import { Package } from "lucide-react"

const footerLinks = {
  Company: [
    { label: "About", href: "/about" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "Pricing", href: "/pricing" },
    { label: "Safety", href: "/safety" },
    { label: "Contact", href: "/contact" },
  ],
  Legal: [
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Prohibited Items", href: "/prohibited-items" },
  ],
  Account: [
    { label: "Login", href: "/login" },
    { label: "Sign Up", href: "/signup" },
    { label: "Track Order", href: "/track/demo" },
  ],
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-md bg-foreground flex items-center justify-center">
                <Package className="h-4 w-4 text-background" />
              </div>
              <span className="text-sm font-semibold text-foreground">SwiftDeliver</span>
            </Link>
            <p className="text-sm text-muted-foreground text-pretty leading-relaxed">
              Fast, reliable, and safe delivery services connecting customers with trusted drivers.
            </p>
          </div>
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">{group}</h3>
              <ul className="flex flex-col gap-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} SwiftDeliver. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">Built for fast, reliable delivery.</p>
        </div>
      </div>
    </footer>
  )
}
