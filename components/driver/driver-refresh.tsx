'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export function DriverRefresh(){
  const router=useRouter()
  useEffect(()=>{
    let lastRefresh=Date.now()
    const refresh=()=>{
      if(document.visibilityState!=='visible'||Date.now()-lastRefresh<15000)return
      lastRefresh=Date.now();router.refresh()
    }
    const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh)
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh)}
  },[router])
  return null
}
