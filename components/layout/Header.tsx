"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, Bell, Menu, X } from "lucide-react"

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 w-full h-16 z-40 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between px-4 md:px-6">
      {/* Left: Logo + Search */}
      <div className="flex items-center gap-3 md:gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#7c5cff] rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-white font-semibold text-lg hidden sm:block">Kinetic Void</span>
        </Link>
        <div className="hidden lg:flex items-center bg-[#2a2a2a] px-4 py-2 rounded-lg w-64">
          <Search className="w-4 h-4 text-[#6b6b6b] mr-2" />
          <input
            className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-[#6b6b6b]"
            placeholder="Track shipment..."
            type="text"
          />
        </div>
      </div>

      {/* Center: Navigation Links (Desktop) */}
      <div className="hidden lg:flex items-center gap-8">
        <Link href="/how-it-works" className="text-[#9a9a9a] hover:text-white text-xs font-medium tracking-wide uppercase transition-colors duration-200">
          How It Works
        </Link>
        <Link href="/fleet" className="text-[#9a9a9a] hover:text-white text-xs font-medium tracking-wide uppercase transition-colors duration-200">
          Our Fleet
        </Link>
        <Link href="/safety" className="text-[#9a9a9a] hover:text-white text-xs font-medium tracking-wide uppercase transition-colors duration-200">
          Safety
        </Link>
        <Link href="/about" className="text-[#9a9a9a] hover:text-white text-xs font-medium tracking-wide uppercase transition-colors duration-200">
          About
        </Link>
        <Link href="/contact" className="text-[#9a9a9a] hover:text-white text-xs font-medium tracking-wide uppercase transition-colors duration-200">
          Contact
        </Link>
      </div>

      {/* Right: Notification, Login, Get Started (Desktop) */}
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

      {/* Mobile: Menu Button */}
      <div className="flex md:hidden items-center gap-4">
        <Bell className="w-5 h-5 text-[#9a9a9a] hover:text-white cursor-pointer transition-colors duration-200" />
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-white p-1"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="absolute top-16 left-0 w-full bg-[#1a1a1a] border-b border-[#2a2a2a] md:hidden">
          {/* Search on Mobile */}
          <div className="flex items-center bg-[#2a2a2a] mx-4 mt-4 px-4 py-2 rounded-lg">
            <Search className="w-4 h-4 text-[#6b6b6b] mr-2" />
            <input
              className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-[#6b6b6b]"
              placeholder="Track shipment..."
              type="text"
            />
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col px-4 py-4 gap-4">
            <Link 
              href="/how-it-works" 
              className="text-[#9a9a9a] hover:text-white text-sm font-medium tracking-wide uppercase transition-colors duration-200"
              onClick={() => setMobileMenuOpen(false)}
            >
              How It Works
            </Link>
            <Link 
              href="/fleet" 
              className="text-[#9a9a9a] hover:text-white text-sm font-medium tracking-wide uppercase transition-colors duration-200"
              onClick={() => setMobileMenuOpen(false)}
            >
              Our Fleet
            </Link>
            <Link 
              href="/safety" 
              className="text-[#9a9a9a] hover:text-white text-sm font-medium tracking-wide uppercase transition-colors duration-200"
              onClick={() => setMobileMenuOpen(false)}
            >
              Safety
            </Link>
            <Link 
              href="/about" 
              className="text-[#9a9a9a] hover:text-white text-sm font-medium tracking-wide uppercase transition-colors duration-200"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
            <Link 
              href="/contact" 
              className="text-[#9a9a9a] hover:text-white text-sm font-medium tracking-wide uppercase transition-colors duration-200"
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="flex flex-col px-4 pb-4 gap-3 border-t border-[#2a2a2a] pt-4">
            <Link 
              href="/login" 
              className="text-white text-sm font-medium text-center py-2 hover:text-[#9a9a9a] transition-colors duration-200"
              onClick={() => setMobileMenuOpen(false)}
            >
              Login
            </Link>
            <Link 
              href="/signup" 
              className="bg-[#7c5cff] hover:bg-[#6b4de6] text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors duration-200 text-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
