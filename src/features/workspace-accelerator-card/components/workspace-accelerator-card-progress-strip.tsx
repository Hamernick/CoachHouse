"use client"

import * as ProgressPrimitive from "@radix-ui/react-progress"
import { clampPercent } from "@/components/accelerator/accelerator-org-snapshot-strip/helpers"
import { WorkspaceAcceleratorReadinessControls } from "./workspace-accelerator-readiness-controls"

import { WorkspaceTutorialCallout } from "@/components/workspace/workspace-tutorial-callout"
import type { WorkspaceAcceleratorTutorialCallout } from "../types"
import type { AcceleratorReadinessSummary } from "@/lib/accelerator/readiness"
import { cn } from "@/lib/utils"

type WorkspaceAcceleratorCardProgressStripProps = {
  progressPercent: number
  readinessSummary?: AcceleratorReadinessSummary | null
  tutorialCallout?: WorkspaceAcceleratorTutorialCallout | null
  showMilestones?: boolean
  showMilestoneTooltips?: boolean
  className?: string
}

export function WorkspaceAcceleratorCardProgressPercent({
  progressPercent,
  tutorialCallout = null,
}: Pick<
  WorkspaceAcceleratorCardProgressStripProps,
  "progressPercent" | "tutorialCallout"
>) {
  return (
    <span
      data-slot="workspace-accelerator-progress-percent"
      className={cn(
        "text-muted-foreground shrink-0 text-[11px] leading-5 font-semibold tabular-nums",
        tutorialCallout?.focus === "progress" &&
          "text-sky-600 dark:text-sky-300"
      )}
    >
      {clampPercent(progressPercent)}% lessons complete
    </span>
  )
}

export function WorkspaceAcceleratorCardProgressRail({
  progressPercent,
  readinessSummary = null,
  tutorialCallout = null,
  showMilestones = true,
  showMilestoneTooltips = true,
  className,
}: WorkspaceAcceleratorCardProgressStripProps) {
  const rail = (
    <div className={cn("space-y-2", className)}>
      <ProgressPrimitive.Root
        data-slot="accelerator-lesson-progress"
        value={clampPercent(progressPercent)}
        max={100}
        aria-label="Lessons complete"
        className="relative h-3 w-full overflow-hidden rounded-full bg-muted"
      >
        <ProgressPrimitive.Indicator
          data-slot="accelerator-lesson-progress-indicator"
          className="h-full rounded-full bg-primary motion-safe:transition-[width]"
          style={{ width: `${clampPercent(progressPercent)}%` }}
        />
      </ProgressPrimitive.Root>
      {showMilestones && showMilestoneTooltips ? (
        <WorkspaceAcceleratorReadinessControls summary={readinessSummary} />
      ) : null}
    </div>
  )

  if (tutorialCallout?.focus !== "progress") {
    return rail
  }

  return (
    <div className="relative pt-5">
      <WorkspaceTutorialCallout
        calloutId="workspace-accelerator-progress-strip:callout"
        mode="indicator"
        indicatorAnchorAlign="start"
        indicatorOffsetX={24}
      />
      {rail}
    </div>
  )
}

export function WorkspaceAcceleratorCardProgressSummary({
  progressPercent,
  readinessSummary = null,
  tutorialCallout = null,
  showMilestones = true,
  showMilestoneTooltips = true,
  className,
}: WorkspaceAcceleratorCardProgressStripProps) {
  return (
    <div

      className={cn("flex min-w-0 flex-1 flex-col gap-2", className)}
    >
      <div

        className="flex min-w-0 items-center justify-between gap-2"
      >
        <p
          className={cn(
            "text-sm font-medium tabular-nums",
            tutorialCallout?.focus === "progress" &&
              "text-sky-600 dark:text-sky-300"
          )}
        >
          {clampPercent(progressPercent)}% lessons complete
        </p>
      </div>
      <div

        className="w-full"
      >
        <WorkspaceAcceleratorCardProgressRail
          progressPercent={progressPercent}
          readinessSummary={readinessSummary}
          tutorialCallout={tutorialCallout}
          showMilestones={showMilestones}
          showMilestoneTooltips={showMilestoneTooltips}
        />
      </div>
    </div>
  )
}

export function WorkspaceAcceleratorCardProgressStrip({
  progressPercent,
  readinessSummary = null,
  tutorialCallout = null,
  showMilestones = true,
  showMilestoneTooltips = true,
}: WorkspaceAcceleratorCardProgressStripProps) {
  return (
    <div className="rounded-lg border border-transparent bg-transparent px-0 pt-0 pb-3">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-foreground truncate text-[15px] leading-5 font-semibold tracking-tight">
            Accelerator
          </p>
          <WorkspaceAcceleratorCardProgressPercent
            progressPercent={progressPercent}
            tutorialCallout={tutorialCallout}
          />
        </div>
        <WorkspaceAcceleratorCardProgressRail
          progressPercent={progressPercent}
          readinessSummary={readinessSummary}
          showMilestones={showMilestones}
          showMilestoneTooltips={showMilestoneTooltips}
        />
      </div>
    </div>
  )
}
