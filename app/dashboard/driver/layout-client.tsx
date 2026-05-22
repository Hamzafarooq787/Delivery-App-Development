"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { DriverSidebar } from "@/components/driver/driver-sidebar"
import { DriverBottomNav } from "@/components/driver/DriverBottomNav"
import { DriverOnboarding } from "@/components/driver/driver-onboarding"
import { RealtimeNotifications } from "@/components/shared/realtime-notifications"
import { ProfileDropdown } from "@/components/shared/profile-dropdown"

interface DriverLayoutClientProps {
  children: React.ReactNode
  user: { full_name: string; email: string }
  isOnline: boolean
  driverStatus: string
  hasDocuments: boolean
  userId: string
}

const ALLOWED_WHEN_LOCKED = ["/dashboard/driver/verification", "/dashboard/driver/support"]

export function DriverLayoutClient({ children, user, isOnline, driverStatus, hasDocuments, userId }: DriverLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const isApproved = driverStatus === "approved"
  const isLocked = !isApproved
  const showOnboarding = isLocked && !ALLOWED_WHEN_LOCKED.some((p) => pathname.startsWith(p))

  return (
    <div className="flex h-screen overflow-hidden bg-[#131313]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:shrink-0 h-full">
        <DriverSidebar user={user} isOnline={isOnline} isLocked={isLocked} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-50 h-full">
            <DriverSidebar user={user} isOnline={isOnline} isLocked={isLocked} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-[#0e0e0e]/60 backdrop-blur-xl flex justify-between items-center px-4 md:px-8 z-40 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex lg:hidden shrink-0 items-center justify-center h-8 w-8 text-[#adaaaa] hover:text-white"
              aria-label="Toggle menu"
            >
              <span className="material-symbols-outlined text-xl">menu</span>
            </button>
            {!isLocked && (
              <div className="relative w-full max-w-md hidden sm:block">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#adaaaa] text-sm">search</span>
                <input
                  className="w-full bg-[#262626]/50 border-none text-sm rounded-lg pl-10 pr-4 py-2 focus:ring-1 focus:ring-[#a3a6ff]/30 text-white placeholder-[#adaaaa] outline-none"
                  placeholder="Search jobs, earnings, or IDs..."
                  type="text"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 md:gap-5 shrink-0">
            {!isLocked && (
              <button className="sm:hidden text-[#adaaaa] hover:text-[#a3a6ff] transition-colors" aria-label="Search">
                <span className="material-symbols-outlined">search</span>
              </button>
            )}
            {userId && isApproved && <RealtimeNotifications role="driver" userId={userId} />}
            <button className="hidden md:block text-[#adaaaa] hover:text-[#a3a6ff] transition-colors" aria-label="Help">
              <span className="material-symbols-outlined">help_outline</span>
            </button>
            <ProfileDropdown
              name={user.full_name}
              email={user.email}
              role="Driver"
              activeRole="driver"
              userId={userId}
              profileHref="/dashboard/driver/profile"
              supportHref="/dashboard/driver/support"
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pt-16 pb-20 lg:pb-0 bg-[#131313]">
          {showOnboarding ? (
            <DriverOnboarding user={user} driverStatus={driverStatus} hasDocuments={hasDocuments} />
          ) : (
            children
          )}
        </main>
        <DriverBottomNav isLocked={isLocked} />
      </div>
    </div>
  )
}
