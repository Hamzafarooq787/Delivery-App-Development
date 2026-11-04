import type { Metadata } from "next"
import Link from "next/link"
import { Bike, Car, Truck } from "lucide-react"
import { VEHICLE_TYPES, VEHICLE_INFO, VEHICLE_CAPABILITIES, PACKAGE_SIZES, PACKAGE_SIZE_INFO } from "@/lib/vehicles"

export const metadata: Metadata = {
  title: "Our Fleet | GoDrop",
  description: "See which parcel sizes can be carried by a bicycle, motorcycle, car or van with GoDrop.",
}

const icons = { bicycle: Bike, motorcycle: Bike, car: Car, van: Truck }

export default function FleetPage() {
  return <section className="mx-auto max-w-5xl px-5 pt-28 pb-16">
    <h1 className="text-4xl sm:text-5xl font-bold mb-4">Vehicles for your delivery</h1>
    <p className="text-[#adaaaa] mb-8">GoDrop matches your parcel with a verified local driver and a suitable vehicle, subject to availability.</p>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {VEHICLE_TYPES.map(type => {
        const Icon = icons[type]
        return <article key={type} className="rounded-2xl bg-[#1a1919] border border-white/10 p-5">
          <Icon aria-hidden className="mb-3 text-[var(--color-primary)]" />
          <h2 className="text-xl font-semibold">{VEHICLE_INFO[type].label}</h2>
          <p className="mt-2 text-[#adaaaa]">Parcel sizes: {VEHICLE_CAPABILITIES[type].map(size => PACKAGE_SIZE_INFO[size].label).join(", ")}</p>
        </article>
      })}
    </div>
    <h2 className="text-2xl font-semibold mt-10 mb-4">Choose your parcel size</h2>
    <dl className="grid gap-4 sm:grid-cols-2">
      {PACKAGE_SIZES.map(size => <div key={size} className="rounded-xl bg-[#1a1919] p-5">
        <dt className="font-semibold">{PACKAGE_SIZE_INFO[size].label}</dt>
        <dd className="text-[#adaaaa]">{PACKAGE_SIZE_INFO[size].description}. {PACKAGE_SIZE_INFO[size].minVehicle}.</dd>
      </div>)}
    </dl>
    <Link href="/dashboard/customer" className="inline-block mt-8 rounded-lg bg-[var(--color-primary)] text-[var(--color-on-primary)] px-5 py-3 font-semibold">Book a delivery</Link>
  </section>
}
