"use client"

import { usePathname } from "next/navigation"
import Header from "./Header"
import Footer from "./Footer"

export default function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === "/") return <>{children}</>
  return <div className="min-h-screen bg-[#0e0e0e] text-white flex flex-col"><Header /><main className="flex-1">{children}</main><Footer /></div>
}
