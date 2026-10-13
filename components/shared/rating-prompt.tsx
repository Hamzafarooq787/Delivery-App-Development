"use client"

import { useState, useTransition } from "react"
import { submitRating } from "@/app/actions/ratings"

type Props = {
  deliveryId: string
  ratedLabel: string
  onSubmitted?: () => void
}

export function RatingPrompt({ deliveryId, ratedLabel, onSubmitted }: Props) {
  const [score, setScore] = useState(0)
  const [hoverScore, setHoverScore] = useState(0)
  const [comment, setComment] = useState("")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit() {
    if (score === 0 || isPending) return
    setError(null)
    startTransition(async () => {
      const result = await submitRating({ deliveryId, score, comment })
      if (result.error) { setError(result.error); return }
      setSubmitted(true)
      onSubmitted?.()
    })
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[#6ee7b7]/20 bg-[#6ee7b7]/5 px-4 py-4 flex items-center gap-3">
        <span className="material-symbols-outlined text-[#6ee7b7] text-xl">check_circle</span>
        <div>
          <p className="text-sm text-[#6ee7b7] font-bold">Thanks for your feedback!</p>
          <p className="text-xs text-[#adaaaa] mt-0.5">It'll be visible once an admin reviews it.</p>
        </div>
      </div>
    )
  }

  const displayScore = hoverScore || score

  return (
    <div className="rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 px-4 py-4 space-y-3">
      <p className="text-sm font-bold text-white">Rate {ratedLabel}</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setScore(n)}
            onMouseEnter={() => setHoverScore(n)}
            onMouseLeave={() => setHoverScore(0)}
            className="p-0.5"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
          >
            <span
              className="material-symbols-outlined text-3xl transition-colors"
              style={{
                fontVariationSettings: displayScore >= n ? "'FILL' 1" : "'FILL' 0",
                color: displayScore >= n ? "#facc15" : "#494847",
              }}
            >
              star
            </span>
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 300))}
        placeholder="Leave a comment (optional)"
        rows={2}
        className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-3 py-2 text-sm text-white placeholder-[#494847] outline-none focus:border-[var(--color-primary)]/50 transition-colors resize-none"
      />
      {error && <p className="text-xs text-[#ff6e84]">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={score === 0 || isPending}
        className="w-full py-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40"
      >
        {isPending ? "Submitting…" : "Submit Rating"}
      </button>
    </div>
  )
}

