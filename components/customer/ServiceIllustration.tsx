import { useId } from 'react'

/** Native SVG illustrations follow the shared brand without bitmap filters. */
export function ServiceIllustration({ kind }: { kind: 'parcel' | 'shopping' }) {
  const id = useId().replaceAll(':', '')
  const top = `${id}-top`, side = `${id}-side`, front = `${id}-front`
  return <svg viewBox="0 0 300 240" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={top} x1="60" y1="50" x2="200" y2="160" gradientUnits="userSpaceOnUse"><stop stopColor="var(--brand-soft)"/><stop offset="1" stopColor="var(--brand-strong)"/></linearGradient>
      <linearGradient id={front} x1="90" y1="95" x2="200" y2="230" gradientUnits="userSpaceOnUse"><stop stopColor="var(--brand-strong)"/><stop offset="1" stopColor="#642e12"/></linearGradient>
      <linearGradient id={side} x1="180" y1="100" x2="230" y2="220" gradientUnits="userSpaceOnUse"><stop stopColor="var(--brand-soft)"/><stop offset="1" stopColor="var(--brand-strong)"/></linearGradient>
    </defs>
    {kind === 'parcel' ? <>
      <ellipse cx="161" cy="213" rx="77" ry="13" fill="#000" fillOpacity=".22"/>
      <path d="M34 190C88 210 145 235 231 187C268 167 275 98 246 61" stroke="var(--brand-soft)" strokeWidth="2.5" strokeDasharray="7 9" strokeLinecap="round"/>
      <path d="m82 90 87-35 76 35-86 36-77-36Z" fill={`url(#${top})`} stroke="var(--brand-soft)" strokeWidth="1.5"/>
      <path d="m82 90 77 36v79l-77-39V90Z" fill={`url(#${front})`} stroke="var(--brand-soft)" strokeWidth="1.5"/>
      <path d="m159 126 86-36v78l-86 37v-79Z" fill={`url(#${side})`} stroke="var(--brand-soft)" strokeWidth="1.5"/>
      <path d="m113 78 77 35v31l17-7v-31l-77-35-17 7Z" fill="#ffefd9" fillOpacity=".8"/>
      <path d="m103 142 29 13v14l-29-13v-14Z" fill="#fff" fillOpacity=".72"/>
      <path d="m103 174 9 4m8 4 12 5" stroke="#fff" strokeOpacity=".35" strokeWidth="2"/>
      <path d="M257 31c-13 0-23 10-23 22 0 17 23 36 23 36s23-19 23-36c0-12-10-22-23-22Z" fill={`url(#${side})`} stroke="var(--brand-soft)" strokeWidth="2"/>
      <circle cx="257" cy="52" r="8" fill="#331b13"/>
      <path d="M48 151c-11 0-19 8-19 18 0 14 19 30 19 30s19-16 19-30c0-10-8-18-19-18Z" fill={`url(#${top})`}/><circle cx="48" cy="168" r="6" fill="#331b13"/>
    </> : <>
      <ellipse cx="156" cy="218" rx="77" ry="13" fill="#000" fillOpacity=".25"/>
      <path d="m77 80 129 13 23 116-147 10L77 80Z" fill={`url(#${front})`} stroke="var(--brand-strong)" strokeWidth="3"/>
      <path d="m206 93 28-12 26 108-31 20-23-116Z" fill={`url(#${side})`} stroke="var(--brand-soft)" strokeWidth="2"/>
      <path d="M106 93V64c0-45 68-46 68 2v34" stroke="var(--brand-soft)" strokeWidth="8" strokeLinecap="round"/>
      <path d="M142 90V65c0-40 60-42 60 3v30" stroke="var(--brand-strong)" strokeWidth="6" strokeLinecap="round"/>
      <path d="m48 70-12-6m26-12-4-14m-15 54-17 1" stroke="var(--brand-soft)" strokeWidth="4" strokeLinecap="round"/>
      <path d="m107 175 19 2m-17 11 34 3" stroke="#fff" strokeOpacity=".2" strokeWidth="3" strokeLinecap="round"/>
    </>}
  </svg>
}
