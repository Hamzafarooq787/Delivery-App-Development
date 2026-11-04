"use client"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { DEFAULT_BRAND, isBrandTheme, type BrandTheme } from '@/lib/brand-theme'
const BrandContext = createContext<{brand: BrandTheme; loaded: boolean; refresh: () => void; apply: (brand: BrandTheme) => void}>({ brand: DEFAULT_BRAND, loaded: false, refresh: () => {}, apply: () => {} })
export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<BrandTheme>(DEFAULT_BRAND)
  const [loaded, setLoaded] = useState(false)
  const version = useRef(0)
  const lastRead = useRef(-Infinity)
  const apply = useCallback((next: BrandTheme) => {
    version.current++
    if (document.documentElement.dataset.brand !== next) document.documentElement.dataset.brand = next
    setBrand(next)
    setLoaded(true)
    try { localStorage.setItem('godrop-brand', next) } catch {}
  }, [])
  const refresh = useCallback(async () => {
    if (performance.now() - lastRead.current < 60000) return
    lastRead.current = performance.now()
    const current = version.current
    try {
      const response = await fetch('/api/brand-theme', { signal: AbortSignal.timeout(2200) })
      if (!response.ok) return
      const data = await response.json()
      if (current === version.current && isBrandTheme(data.brand)) apply(data.brand)
    } catch { /* Keep the last verified brand on a temporary network failure. */ }
    finally { setLoaded(true) }
  }, [apply])
  useEffect(() => {
    const saved = document.documentElement.dataset.brand
    if (isBrandTheme(saved)) queueMicrotask(() => setBrand(saved))
    void refresh()
    const timer = setInterval(() => { if (!document.hidden) void refresh() }, 60000)
    const focus = () => { if (!document.hidden) void refresh() }
    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', focus)
    return () => { clearInterval(timer); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus) }
  }, [refresh])
  return <BrandContext.Provider value={{ brand, loaded, refresh, apply }}>{children}</BrandContext.Provider>
}
export const useBrand = () => useContext(BrandContext)
