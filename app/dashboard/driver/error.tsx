'use client'
export default function DriverError({reset}:{reset:()=>void}){
 return <section className="m-4 rounded-xl border border-red-400/30 bg-[var(--brand-panel)] p-6 text-white" role="alert"><h1 className="text-xl font-bold">This page could not load</h1><p className="my-3">Your saved information has not been changed. Check your connection and try again.</p><button onClick={reset} className="rounded-lg bg-[var(--brand-strong)] px-5 py-3 text-[var(--brand-ink)]">Try again</button></section>
}
