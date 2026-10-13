import type { Metadata } from "next"
import HomeSlides from "@/components/home/HomeSlides"

export const metadata: Metadata = {
  title: "GoDrop | Local Collection, Delivery & Shopping Service",
  description: "Need something collected, delivered or bought from a shop? GoDrop makes local deliveries and everyday shopping requests simple.",
}

export default function HomePage() {
  return <HomeSlides />
}

