"use client"

import { useState } from "react"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { DashboardHeader } from "@/components/shared/dashboard-header"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:flex lg:shrink-0">
        <AdminSidebar />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50">
            <AdminSidebar onClose={() => setSidebarOpen(false)} />
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
