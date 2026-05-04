"use client"

import { useState } from "react"
import { DriverSidebar } from "@/components/driver/driver-sidebar"

interface DriverLayoutClientProps {
  children: React.ReactNode
  user: { full_name: string; email: string }
}

export function DriverLayoutClient({ children, user }: DriverLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[#131313]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:shrink-0 h-full">
        <DriverSidebar user={user} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-50 h-full">
            <DriverSidebar user={user} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-[#0e0e0e]/60 backdrop-blur-xl flex justify-between items-center px-8 z-40 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex lg:hidden items-center justify-center h-8 w-8 text-[#adaaaa] hover:text-white"
              aria-label="Toggle menu"
            >
              <span className="material-symbols-outlined text-xl">menu</span>
            </button>
            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#adaaaa] text-sm">search</span>
              <input
                className="w-full bg-[#262626]/50 border-none text-sm rounded-lg pl-10 pr-4 py-2 focus:ring-1 focus:ring-[#a3a6ff]/30 text-white placeholder-[#adaaaa] outline-none"
                placeholder="Search jobs, earnings, or IDs..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-5">
            <button className="text-[#adaaaa] hover:text-[#a3a6ff] transition-colors" aria-label="Notifications">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="text-[#adaaaa] hover:text-[#a3a6ff] transition-colors" aria-label="Help">
              <span className="material-symbols-outlined">help_outline</span>
            </button>
            <div className="h-8 w-8 rounded-full bg-[#262626] flex items-center justify-center border border-[#494847]/30">
              <span className="material-symbols-outlined text-sm text-[#adaaaa]">person</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pt-16 bg-[#131313]">
          {children}
        </main>
      </div>
    </div>
  )
}
