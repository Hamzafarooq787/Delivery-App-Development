import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SearchX } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <SearchX className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            404 — Page Not Found
          </h1>
          <p className="text-muted-foreground text-balance">
            The page you&apos;re looking for doesn&apos;t exist or has been moved. Check the URL and try again.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
          <Link href="/contact">
            <Button variant="outline">Contact Support</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
