import type { Metadata } from "next"
import { connection } from "next/server"
import type { ReactNode } from "react"

export const metadata: Metadata = { title: "Sign in | GoDrop" }
export default async function LoginLayout({children}: {children:ReactNode}) {
  // Render the sign-in form even before the browser hydrates its search params.
  await connection()
  return children
}
