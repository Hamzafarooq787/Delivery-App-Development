"use client"

import { useState, useTransition } from "react"
import { adminApproveRating, adminRejectRating, type PendingRating } from "@/app/actions/ratings"

function Stars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className="material-symbols-outlined text-base"
          style={{ fontVariationSettings: n <= score ? "'FILL' 1" : "'FILL' 0", color: n <= score ? "#facc15" : "var(--color-outline-variant)" }}
        >
          star
        </span>
      ))}
    </div>
  )
}

function ReviewCard({ rating, onResolved }: { rating: PendingRating; onResolved: (id: string) => void }) {
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<"approve" | "reject" | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleAction(type: "approve" | "reject") {
    setAction(type)
    setError(null)
    startTransition(async () => {
      const result = type === "approve" ? await adminApproveRating(rating.id) : await adminRejectRating(rating.id)
      if (result.error) { setError(result.error); setAction(null); return }
      onResolved(rating.id)
    })
  }

  const raterLabel = rating.rater_role === "customer" ? "Customer" : "Driver"
  const ratedLabel = rating.rater_role === "customer" ? "Driver" : "Customer"

  return (
    <div className="bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--color-on-surface-variant)]">
            <span className="font-bold text-white">{rating.rater?.full_name ?? "Unknown"}</span> ({raterLabel}) rated{" "}
            <span className="font-bold text-white">{rating.rated?.full_name ?? "Unknown"}</span> ({ratedLabel})
          </p>
          <p className="text-[10px] text-[var(--color-outline-variant)] mt-0.5 font-mono">
            {rating.delivery?.tracking_number ?? `Delivery ${rating.delivery_id.slice(0, 8).toUpperCase()}`}
          </p>
        </div>
        <Stars score={rating.score} />
      </div>

      {rating.comment && (
        <p className="text-sm text-white bg-[var(--brand-bg)] border border-[var(--color-outline-variant)]/10 rounded-lg px-3 py-2.5 leading-relaxed">
          "{rating.comment}"
        </p>
      )}

      {error && <p className="text-xs text-[#ff6e84]">{error}</p>}

      {rating.status === "pending" ? (
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => handleAction("reject")}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff6e84] text-xs font-bold hover:bg-[#ff6e84]/20 transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm">cancel</span>
          {isPending && action === "reject" ? "Rejecting…" : "Reject"}
        </button>
        <button
          onClick={() => handleAction("approve")}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold hover:bg-green-500/20 transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm">check_circle</span>
          {isPending && action === "approve" ? "Approving…" : "Approve & Publish"}
        </button>
      </div>
      ) : <p className="text-sm capitalize text-white">{rating.status} · Moderated {rating.moderated_at ? new Date(rating.moderated_at).toLocaleDateString("en-GB") : "previously"}</p>}
    </div>
  )
}

export function ReviewsPanel({ initialRatings }: { initialRatings: PendingRating[] }) {
  const [ratings, setRatings] = useState(initialRatings)

  return (
    <div className="px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 md:mb-10">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter text-white font-headline">Reviews</h1>
          <p className="text-[var(--color-on-surface-variant)] mt-1">Approve or reject ratings before they're published to the other party.</p>
        </div>
        {ratings.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--brand-strong)]/10 border border-[var(--brand-strong)]/20 rounded-full">
            <span className="w-2 h-2 rounded-full bg-[var(--brand-strong)] animate-pulse" />
            <span className="text-xs font-bold text-[var(--brand-soft)]">{ratings.filter(r=>r.status==="pending").length} pending in this page</span>
          </div>
        )}
      </div>

      {ratings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-outline-variant)]/30 bg-[var(--brand-panel)] px-6 py-20 text-center">
          <span className="material-symbols-outlined text-4xl text-[var(--color-outline-variant)] mb-3 block">rate_review</span>
          <p className="text-base font-semibold text-white">No matching reviews</p>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">Change the filters to browse pending, approved and rejected reviews.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ratings.map((r) => (
            <ReviewCard key={r.id} rating={r} onResolved={(id) => setRatings((prev) => prev.filter((x) => x.id !== id))} />
          ))}
        </div>
      )}
    </div>
  )
}

