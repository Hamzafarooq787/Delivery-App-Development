import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ShieldOff } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <ShieldOff className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            401 — Unauthorized
          </h1>
          <p className="text-muted-foreground text-balance">
            You need to be signed in to access this page. Please log in and try again.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login">
            <Button>Sign In</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
