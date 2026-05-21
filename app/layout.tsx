import type { Metadata } from 'next'
import { Manrope, Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/shared/theme-provider'
import './globals.css'

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
        {/* Anti-flash: apply saved theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('kv-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0e0e0e] font-inter text-white overflow-x-hidden antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Toaster
          position="top-right"
          theme="dark"
          gap={8}
          toastOptions={{
            duration: 5000,
            style: {
              background: 'rgba(17,17,17,0.96)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(73,72,71,0.25)',
              color: '#ffffff',
              borderRadius: '16px',
              padding: '14px 16px',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: '500',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(163,166,255,0.06)',
              minWidth: '300px',
              maxWidth: '380px',
            },
            classNames: {
              title: 'font-bold text-white text-sm',
              description: 'text-[#adaaaa] text-xs mt-0.5 leading-relaxed',
              icon: 'text-base',
              actionButton: 'bg-[#a3a6ff] text-[#0f00a4] font-bold text-xs rounded-lg px-3 py-1.5 hover:brightness-110',
              cancelButton: 'bg-[#262626] text-[#adaaaa] font-bold text-xs rounded-lg px-3 py-1.5',
              closeButton: 'text-[#adaaaa] hover:text-white hover:bg-[#262626] rounded-lg',
              success: 'border-l-2 border-l-emerald-500',
              error: 'border-l-2 border-l-[#ff6e84]',
              warning: 'border-l-2 border-l-amber-400',
              info: 'border-l-2 border-l-[#4a9fd4]',
            },
          }}
        />
        <Analytics />
      </body>
    </html>
  )
}
