import type { Metadata } from "next"
import Link from "next/link"
import { Package, ShoppingBag, MapPin } from "lucide-react"

export const metadata: Metadata = {
  title: "About GoDrop",
  description: "GoDrop helps people and businesses arrange local collections, deliveries and shopping in the UK.",
}

export default function AboutPage() {
  return <section className="mx-auto max-w-5xl px-5 pt-28 pb-16">
    <h1 className="text-4xl sm:text-5xl font-bold mb-4">About GoDrop</h1>
    <p className="text-[#adaaaa] max-w-2xl mb-8">GoDrop helps people and businesses arrange local collections and deliveries in the UK. Tell us where the parcel needs to go, check your price and follow its progress.</p>
    <div className="grid gap-4 sm:grid-cols-3">
      {[
        {Icon:Package, title:"Send a parcel", text:"Book a collection and delivery for everyday items."},
        {Icon:ShoppingBag, title:"Arrange local shopping", text:"Use Buy for Me to ask a driver to pick up items from a shop."},
        {Icon:MapPin, title:"Follow your delivery", text:"Use your tracking number to check the latest status."},
      ].map(({Icon,title,text}) => <article key={title} className="rounded-xl bg-[#1a1919] border border-white/10 p-5"><Icon aria-hidden className="text-[var(--color-primary)] mb-3" /><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-[#adaaaa]">{text}</p></article>)}
    </div>
    <Link href="/contact" className="inline-block mt-8 underline">Contact GoDrop</Link>
  </section>
}
