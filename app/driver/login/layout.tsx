import { connection } from "next/server"
import type { ReactNode } from "react"

export default async function DriverLoginLayout({ children }: { children: ReactNode }) {
  // Render the sign-in form even before the browser hydrates its search params.
  await connection()
  return children
}
