import type { Metadata } from 'next'
import { Manrope, Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'
import 'mapbox-gl/dist/mapbox-gl.css'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['200', '400', '600', '800'],
  variable: '--font-manrope',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Kinetic Void | Premium Logistics',
  description:
    'Experience precision-engineered delivery solutions. From microscopic components to industrial fleets, we bridge the void with absolute speed.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${manrope.variable} ${inter.variable}`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0e0e0e] font-inter text-white overflow-x-hidden antialiased">
        {children}
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: '#1a1919',
              border: '1px solid rgba(73,72,71,0.3)',
              color: '#fff',
              borderRadius: '14px',
            },
          }}
        />
        <Analytics />
      </body>
    </html>
  )
}
