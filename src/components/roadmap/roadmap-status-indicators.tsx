import CheckIcon from "lucide-react/dist/esm/icons/check"
import { cn } from "@/lib/utils"
import type { RoadmapSectionStatus } from "@/lib/roadmap/types"

export function RoadmapTocStatusDot({
  status,
}: {
  status: RoadmapSectionStatus
}) {
  const statusClass =
    status === "complete"
      ? "bg-emerald-500"
      : status === "in_progress"
        ? "bg-amber-500"
        : "bg-border"

  return (
    <span
      aria-hidden
      className={cn("h-2 w-2 shrink-0 rounded-full", statusClass)}
    />
  )
}

export function RoadmapTocCompletedRailSegment({
  className,
}: { className?: string } = {}) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-foreground/90 pointer-events-none absolute top-0 left-[calc(var(--roadmap-toc-rail-offset)-var(--roadmap-toc-content-offset))] z-10 h-full w-[2px] rounded-full",
        className
      )}
    />
  )
}

const ROADMAP_TOC_INLINE_ICON_CLASS_NAME =
  "text-muted-foreground/70 ml-auto inline-flex h-4 w-4 shrink-0 items-center justify-center"

export function RoadmapTocCompletionCheck({
  status,
}: {
  status: RoadmapSectionStatus
}) {
  if (status !== "complete") return null

  return (
    <span aria-hidden className={ROADMAP_TOC_INLINE_ICON_CLASS_NAME}>
      <CheckIcon className="h-3.5 w-3.5" strokeWidth={2} />
    </span>
  )
}
