"use client"

import { useState } from "react"
import { CustomerSidebar } from "@/components/customer/customer-sidebar"
import { DashboardHeader } from "@/components/shared/dashboard-header"

interface CustomerLayoutClientProps {
  children: React.ReactNode
  user: { full_name: string; email: string }
}

export function CustomerLayoutClient({ children, user }: CustomerLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:flex lg:shrink-0">
        <CustomerSidebar user={user} />
      </div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50">
            <CustomerSidebar user={user} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
