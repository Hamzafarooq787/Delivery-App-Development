"use client"
import { usePathname } from "next/navigation"
import Footer from "./Footer"

const routes = new Set(["/login", "/signup", "/download", "/forgot-password", "/driver/login", "/auth/account-linked", "/auth/invite", "/offline", "/forbidden", "/unauthorized"])
export function StandaloneFooter() {
  return routes.has(usePathname()) ? <Footer /> : null
}
