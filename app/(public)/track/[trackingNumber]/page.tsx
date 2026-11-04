import { redirect } from "next/navigation"

export default async function LegacyTrackingPage({params}: {params:Promise<{trackingNumber:string}>}) {
  const {trackingNumber} = await params
  redirect("/track?" + new URLSearchParams({number:trackingNumber}))
}
