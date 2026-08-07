import { adminGetPendingRatings } from "@/app/actions/ratings"
import { ReviewsPanel } from "@/components/admin/reviews-panel"

export const dynamic = "force-dynamic"

export default async function AdminReviewsPage() {
  const { data } = await adminGetPendingRatings()
  return <ReviewsPanel initialRatings={data} />
}
