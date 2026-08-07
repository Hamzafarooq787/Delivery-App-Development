"use client"

import { useEffect, useState } from "react"
import { getMyRatingForDelivery, type Rating } from "@/app/actions/ratings"
import { RatingPrompt } from "@/components/shared/rating-prompt"

export function RateCustomerCard({ deliveryId }: { deliveryId: string }) {
  const [rating, setRating] = useState<Rating | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    getMyRatingForDelivery(deliveryId).then((res) => { if (!cancelled) setRating(res.data) })
    return () => { cancelled = true }
  }, [deliveryId])

  if (rating === undefined) return null

  if (rating) {
    return (
      <div className="bg-[rgba(38,38,38,0.6)] backdrop-blur-xl border border-[#494847]/10 rounded-xl p-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-yellow-400 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
        <div>
          <p className="text-sm text-white">You rated this customer {rating.score}/5</p>
          <p className="text-[10px] text-[#adaaaa] mt-0.5">
            {rating.status === "pending" ? "Pending admin review" : rating.status === "approved" ? "Published" : "Not published"}
          </p>
        </div>
      </div>
    )
  }

  return <RatingPrompt deliveryId={deliveryId} ratedLabel="the customer" />
}
