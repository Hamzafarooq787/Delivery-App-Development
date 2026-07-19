/**
 * components/ui/sub-tabs.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Segmented sub-tab control used to present two closely-related pages as one
 * nav tab (e.g. Payments → Charges | Wallet). Each sub-tab is a real route so
 * deep links, Stripe redirect URLs, and per-page logic keep working unchanged.
 */
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export interface SubTab {
  label: string
  href: string
  icon?: string
}

export function SubTabs({ tabs, className = "" }: { tabs: SubTab[]; className?: string }) {
  const pathname = usePathname()

  return (
    <div className={`flex rounded-xl bg-[#1a1919] border border-[#262626] p-1 w-fit ${className}`}>
      {tabs.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              active
                ? "bg-[#a3a6ff] text-[#0f00a4]"
                : "text-[#adaaaa] hover:text-white"
            }`}
          >
            {tab.icon && (
              <span className="material-symbols-outlined text-base" style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {tab.icon}
              </span>
            )}
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
