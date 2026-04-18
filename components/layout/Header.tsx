"use client"

import Link from 'next/link'
import { useState } from 'react'
import { Search, Bell, Menu, X } from 'lucide-react'

const navLinks = [
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Our Fleet', href: '/fleet' },
  { label: 'Safety', href: '/safety' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
]

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 w-full z-40 bg-[#1a1a1a] border-b border-[#2a2a2a]">
      {/* Main bar */}
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        {/* Left: Logo + Search */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#7c5cff] rounded-lg flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-white font-semibold text-lg">Kinetic Void</span>
          </Link>
          <div className="hidden lg:flex items-center bg-[#2a2a2a] px-4 py-2 rounded-lg w-64">
            <Search className="w-4 h-4 text-[#6b6b6b] mr-2 flex-shrink-0" />
            <input
              className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-[#6b6b6b]"
              placeholder="Track shipment..."
              type="text"
            />
          </div>
        </div>

        {/* Center: Navigation Links (desktop) */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[#9a9a9a] hover:text-white text-xs font-medium tracking-wide uppercase transition-colors duration-200"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right: Actions (desktop) */}
        <div className="hidden md:flex items-center gap-6">
          <Bell className="w-5 h-5 text-[#9a9a9a] hover:text-white cursor-pointer transition-colors duration-200" />
          <Link href="/login" className="text-white text-sm font-medium hover:text-[#9a9a9a] transition-colors duration-200">
            Login
          </Link>
          <Link
            href="/signup"
            className="bg-[#7c5cff] hover:bg-[#6b4de6] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-200"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile: burger button */}
        <button
          className="flex md:hidden items-center justify-center w-9 h-9 text-[#9a9a9a] hover:text-white transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#1a1a1a] border-t border-[#2a2a2a]">
          {/* Mobile search */}
          <div className="px-4 pt-3">
            <div className="flex items-center bg-[#2a2a2a] px-4 py-2 rounded-lg">
              <Search className="w-4 h-4 text-[#6b6b6b] mr-2 flex-shrink-0" />
              <input
                className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-[#6b6b6b]"
                placeholder="Track shipment..."
                type="text"
              />
            </div>
          </div>

          {/* Mobile nav links */}
          <nav className="flex flex-col gap-1 p-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-4 py-3 text-sm text-[#9a9a9a] hover:bg-[#2a2a2a] hover:text-white transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            {/* Mobile auth buttons */}
            <div className="mt-3 flex flex-col gap-2 border-t border-[#2a2a2a] pt-3">
              <Link
                href="/login"
                className="text-center rounded-lg px-4 py-2.5 text-sm text-white border border-[#2a2a2a] hover:bg-[#2a2a2a] transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="text-center rounded-lg px-4 py-2.5 text-sm font-semibold bg-[#7c5cff] hover:bg-[#6b4de6] text-white transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      )}
    </nav>
  )
}
