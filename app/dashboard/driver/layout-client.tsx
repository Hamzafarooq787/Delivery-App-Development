'use client'

import { BrandLogo } from '@/components/shared/brand-logo'
import styles from '@/components/driver/MapFirstDashboard.module.css'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { DriverSidebar } from '@/components/driver/driver-sidebar'
import { DriverBottomNav } from '@/components/driver/DriverBottomNav'
import { DriverOnboarding } from '@/components/driver/driver-onboarding'
import { RealtimeNotifications } from '@/components/shared/realtime-notifications'
import { ProfileDropdown } from '@/components/shared/profile-dropdown'
import { InstallButton } from '@/components/pwa/install-button'
import { FloatingLiveChat } from '@/components/driver/floating-live-chat'
import { TestPushButton } from '@/components/driver/test-push-button'

interface DriverLayoutClientProps {
  children: React.ReactNode
  user: { full_name: string; email: string }
  isOnline: boolean
  driverStatus: string
  hasDocuments: boolean
  userId: string
}

const ALLOWED_WHEN_LOCKED = [
  '/dashboard/driver/verification',
  '/dashboard/driver/support',
]

export function DriverLayoutClient({
  children,
  user,
  isOnline,
  driverStatus,
  hasDocuments,
  userId,
}: DriverLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const isApproved = driverStatus === 'approved'
  const isLocked = !isApproved
  const isMapDashboard = isApproved && pathname === '/dashboard/driver'
  const showOnboarding =
    isLocked && !ALLOWED_WHEN_LOCKED.some((p) => pathname.startsWith(p))

  return (
    <div
      className={`flex h-screen overflow-hidden bg-[var(--brand-bg)] ${isMapDashboard ? styles.dashboardRoot : ''}`}
    >
      {/* Desktop Sidebar */}
      <div
        className={`hidden lg:flex lg:shrink-0 h-full ${isMapDashboard ? styles.desktopSidebar : ''}`}
      >
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
            <DriverSidebar
              user={user}
              isOnline={isOnline}
              isLocked={isLocked}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        {!isMapDashboard && (
          <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-[var(--brand-panel)] backdrop-blur-xl flex justify-between items-center px-2 sm:px-4 md:px-8 z-40 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="flex lg:hidden shrink-0 items-center justify-center h-8 w-8 text-[var(--color-on-surface-variant)] hover:text-white"
                aria-label="Toggle menu"
              >
                <span className="material-symbols-outlined text-xl">menu</span>
              </button>
              <a
                href="/dashboard/driver"
                aria-label="GoDrop driver home"
                className="lg:hidden shrink-0 w-20 min-[380px]:w-24 sm:w-32 [&_.brand-logo]:w-full [&_.brand-logo]:h-9"
              >
                <BrandLogo />
              </a>
              {!isLocked && (
                <div className="relative w-full max-w-md hidden lg:block">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] text-sm">
                    search
                  </span>
                  <input
                    className="w-full bg-[var(--color-surface-container-highest)]/50 border-none text-sm rounded-lg pl-10 pr-4 py-2 focus:ring-1 focus:ring-[var(--brand-strong)]/30 text-white placeholder-[var(--color-on-surface-variant)] outline-none"
                    placeholder="Search jobs, earnings, or IDs..."
                    type="text"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-3 md:gap-5 shrink-0">
              <TestPushButton />
              <InstallButton />
              {!isLocked && (
                <button
                  className="lg:hidden text-[var(--color-on-surface-variant)] hover:text-[var(--brand-soft)] transition-colors"
                  aria-label="Search"
                >
                  <span className="material-symbols-outlined">search</span>
                </button>
              )}
              {userId && isApproved && (
                <RealtimeNotifications role="driver" userId={userId} />
              )}
              <button
                className="hidden md:block text-[var(--color-on-surface-variant)] hover:text-[var(--brand-soft)] transition-colors"
                aria-label="Help"
              >
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
        )}

        <main
          className={
            isMapDashboard
              ? styles.dashboardMain
              : 'flex-1 overflow-y-auto pt-16 pb-20 lg:pb-0 bg-[var(--brand-bg)]'
          }
        >
          {showOnboarding ? (
            <DriverOnboarding
              user={user}
              driverStatus={driverStatus}
              hasDocuments={hasDocuments}
            />
          ) : (
            children
          )}
        </main>
        <DriverBottomNav
          isLocked={isLocked}
          onMore={() => setSidebarOpen(true)}
        />
        {isApproved &&
          !isMapDashboard &&
          !pathname.startsWith('/dashboard/driver/jobs/') && (
            <FloatingLiveChat />
          )}
      </div>
    </div>
  )
}
