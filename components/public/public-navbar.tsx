"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X } from "lucide-react"

const navLinks = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Our Fleet", href: "/our-fleet" },
  { label: "Safety", href: "/safety" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
]

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 w-full h-16 z-40 bg-[#0e0e0e]/80 backdrop-blur-xl border-b border-[#494847]/15 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between h-full px-4 sm:px-6 lg:px-12">
        {/* Logo + Search */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#a3a6ff] rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-[#0f00a4]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13.13 22.19L11.5 18.36C13.07 17.78 14.54 17 15.9 16.09L13.13 22.19M5.64 12.5L1.81 10.87L7.91 8.1C7 9.46 6.22 10.93 5.64 12.5M19.22 4C19.5 4.78 19.65 5.61 19.65 6.5C19.65 12.39 14.67 17.31 8.74 17.95L6.5 15.71C6.93 12.87 8.5 10.35 10.95 8.72C11.35 8.45 11.63 8.04 11.71 7.57C11.79 7.1 11.66 6.62 11.36 6.26C11.06 5.89 10.62 5.67 10.15 5.66C9.68 5.65 9.23 5.86 8.92 6.22C8.16 7.1 7.58 8.13 7.2 9.22L4.78 6.8C5.94 4.37 8.32 2.71 11.08 2.51C11.79 2.43 12.5 2.45 13.2 2.56C15.53 2.94 17.6 4.14 19.22 4M12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14Z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white tracking-tighter font-headline">Go Drop</span>
          </Link>
          <div className="hidden lg:flex items-center bg-[#262626] px-4 py-1.5 rounded-full border border-[#494847]/15 focus-within:ring-1 focus-within:ring-[#a3a6ff]/30 transition-all">
            <svg className="w-4 h-4 text-[#adaaaa] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="bg-transparent border-none outline-none text-xs text-white w-44 placeholder:text-[#adaaaa]/60"
              placeholder="Track shipment..."
              type="text"
            />
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 text-[#adaaaa] font-medium text-xs uppercase tracking-widest">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-white transition-colors duration-200"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="hidden md:flex items-center gap-4 text-[#adaaaa] border-l border-[#494847]/20 pl-6">
          <svg className="w-5 h-5 hover:text-white cursor-pointer transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <Link
            href="/login"
            className="text-xs font-semibold hover:text-white transition-colors"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="bg-[#a3a6ff] text-[#0f00a4] text-xs font-bold px-4 py-2 rounded-lg hover:brightness-110 transition-all active:scale-95"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          className="flex md:hidden items-center justify-center h-8 w-8 text-[#adaaaa]"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0e0e0e]/95 backdrop-blur-xl border-t border-[#494847]/15">
          <nav className="flex flex-col gap-1 p-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl px-4 py-3 text-sm text-[#adaaaa] hover:bg-[#1a1919] hover:text-white transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-[#494847]/20 pt-3">
              <Link
                href="/login"
                className="text-center rounded-xl px-4 py-2.5 text-sm text-[#adaaaa] border border-[#494847]/30 hover:bg-[#1a1919] transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="text-center rounded-xl px-4 py-2.5 text-sm font-bold bg-[#a3a6ff] text-[#0f00a4] hover:brightness-110 transition-all"
                onClick={() => setMobileOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
