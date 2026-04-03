"use client"

import Link from "next/link"
import { Package, Menu, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DashboardHeaderProps {
  onMenuToggle?: () => void
  title?: string
}

export function DashboardHeader({ onMenuToggle, title }: DashboardHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="flex lg:hidden items-center justify-center h-8 w-8 rounded-md hover:bg-secondary transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
        {title && (
          <span className="text-sm font-medium text-muted-foreground hidden md:block">{title}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-secondary transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4 text-foreground" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-foreground"></span>
        </button>
      </div>
    </header>
  )
}
