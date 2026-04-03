import { cn } from "@/lib/utils"

interface TimelineStep {
  label: string
  description?: string
  status: "completed" | "active" | "upcoming"
  time?: string
}

interface TimelineProps {
  steps: TimelineStep[]
  className?: string
}

export function Timeline({ steps, className }: TimelineProps) {
  return (
    <ol className={cn("relative border-l border-border ml-3", className)}>
      {steps.map((step, i) => (
        <li key={i} className="mb-6 ml-6">
          <span
            className={cn(
              "absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background text-xs font-semibold",
              step.status === "completed" && "bg-foreground text-background",
              step.status === "active" && "bg-foreground text-background animate-pulse",
              step.status === "upcoming" && "bg-muted text-muted-foreground"
            )}
          >
            {i + 1}
          </span>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={cn("text-sm font-medium", step.status === "upcoming" && "text-muted-foreground")}>
                {step.label}
              </p>
              {step.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
              )}
            </div>
            {step.time && (
              <span className="text-xs text-muted-foreground shrink-0">{step.time}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
