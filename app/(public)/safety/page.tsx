import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Delivery Safety | GoDrop",
  description: "Check what GoDrop can carry and how to prepare your parcel for collection.",
}

export default function SafetyPage() {
  return <section className="mx-auto max-w-4xl px-5 pt-28 pb-16">
    <h1 className="text-4xl sm:text-5xl font-bold mb-4">Delivery safety</h1>
    <p className="text-[#adaaaa] mb-8">Before you book, check what you can send and choose a vehicle that can carry your parcel.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <article className="rounded-2xl bg-[#1a1919] border border-white/10 p-6">
        <h2 className="text-xl font-semibold mb-2">Check what you can send</h2>
        <p className="text-[#adaaaa] mb-3">Some items, including hazardous or illegal goods, cannot be carried. Check the full list before booking.</p>
        <Link className="underline" href="/prohibited-items">Read the prohibited items list</Link>
      </article>
      <article className="rounded-2xl bg-[#1a1919] border border-white/10 p-6">
        <h2 className="text-xl font-semibold mb-2">Prepare your parcel</h2>
        <p className="text-[#adaaaa] mb-3">Pack it securely and choose the right size. Add any collection or delivery instructions when you book.</p>
        <Link className="underline" href="/our-fleet">Check parcel sizes and vehicles</Link>
      </article>
    </div>
    <p className="mt-8">Not sure if your item can be carried? <Link href="/contact" className="underline">Ask us before you book.</Link></p>
  </section>
}
