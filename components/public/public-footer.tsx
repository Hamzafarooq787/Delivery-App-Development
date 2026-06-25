import Link from "next/link"

const footerLinks = {
  Network: [
    { label: "How It Works", href: "/how-it-works" },
    { label: "Our Fleet", href: "/our-fleet" },
    { label: "Safety & Compliance", href: "/safety" },
    { label: "Pricing", href: "/pricing" },
  ],
  Company: [
    { label: "About Us", href: "/about" },
    { label: "Contact HQ", href: "/contact" },
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms of Service", href: "/terms" },
  ],
  Platform: [
    { label: "Login", href: "/login" },
    { label: "Sign Up", href: "/signup" },
    { label: "Track Shipment", href: "/track/demo" },
    { label: "Prohibited Items", href: "/prohibited-items" },
  ],
}

export function PublicFooter() {
  return (
    <footer className="bg-[#000000] border-t border-[#494847]/15 w-full py-12 sm:py-16 px-4 sm:px-8 md:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 mb-12 sm:mb-16">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-5">
              <div className="w-7 h-7 bg-[#a3a6ff] rounded flex items-center justify-center">
                <svg className="w-4 h-4 text-[#0f00a4]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13.13 22.19L11.5 18.36C13.07 17.78 14.54 17 15.9 16.09L13.13 22.19M5.64 12.5L1.81 10.87L7.91 8.1C7 9.46 6.22 10.93 5.64 12.5M19.22 4C19.5 4.78 19.65 5.61 19.65 6.5C19.65 12.39 14.67 17.31 8.74 17.95L6.5 15.71C6.93 12.87 8.5 10.35 10.95 8.72C11.35 8.45 11.63 8.04 11.71 7.57C11.79 7.1 11.66 6.62 11.36 6.26C11.06 5.89 10.62 5.67 10.15 5.66C9.68 5.65 9.23 5.86 8.92 6.22C8.16 7.1 7.58 8.13 7.2 9.22L4.78 6.8C5.94 4.37 8.32 2.71 11.08 2.51C11.79 2.43 12.5 2.45 13.2 2.56C15.53 2.94 17.6 4.14 19.22 4M12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14Z" />
                </svg>
              </div>
              <span className="text-base font-bold text-white tracking-tighter font-headline">Go Drop</span>
            </Link>
            <p className="text-sm text-[#adaaaa] leading-relaxed text-pretty">
              Precision-engineered logistics architecture. Bridging the void between origin and destination with absolute speed.
            </p>
          </div>

          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-white">{group}</h3>
              <ul className="flex flex-col gap-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#adaaaa] hover:text-[#a3a6ff] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-[#494847]/15 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#adaaaa] uppercase tracking-widest">
            &copy; {new Date().getFullYear()} Go Drop Logistics. All rights reserved.
          </p>
          <p className="text-xs text-[#adaaaa]/50 uppercase tracking-widest">
            Sector Latency: 14ms &bull; All systems nominal
          </p>
        </div>
      </div>
    </footer>
  )
}
