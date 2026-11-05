import { SupportContactLinks } from "@/components/public/support-contact-links"
import Link from "next/link"

export default function Footer() {
  return <footer className="shrink-0 border-t border-white/10 bg-[#0e0e0e] px-4 py-2 text-center text-xs normal-case text-[#adaaaa]">
    <p>Local collection and delivery across the UK</p>
    <nav aria-label="Footer links" className="my-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
      <Link href="/pricing" className="inline-flex min-h-11 items-center px-1 hover:underline">Pricing</Link>
      <Link href="/contact" className="inline-flex min-h-11 items-center px-2 hover:underline">Contact</Link>
      <Link href="/privacy-policy" className="inline-flex min-h-11 items-center px-2 hover:underline">Privacy</Link>
      <Link href="/terms" className="inline-flex min-h-11 items-center px-2 hover:underline">Terms</Link>
      <Link href="/safety" className="inline-flex min-h-11 items-center px-2 hover:underline">Safety</Link>
      <Link href="/prohibited-items" className="inline-flex min-h-11 items-center px-2 hover:underline">Prohibited items</Link>
    </nav>
    <SupportContactLinks/>
    <p>© {new Date().getFullYear()} GoDrop. All rights reserved.</p>
  </footer>
}
