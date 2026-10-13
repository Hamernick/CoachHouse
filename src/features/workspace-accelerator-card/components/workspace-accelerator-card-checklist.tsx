"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import BookOpenIcon from "lucide-react/dist/esm/icons/book-open"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import CircleCheckIcon from "lucide-react/dist/esm/icons/circle-check"
import ClipboardListIcon from "lucide-react/dist/esm/icons/clipboard-list"
import FileTextIcon from "lucide-react/dist/esm/icons/file-text"
import VideoIcon from "lucide-react/dist/esm/icons/video"

import {
  ACCELERATOR_PROGRESS_SEGMENT_VISUALS,
  resolveAcceleratorModuleProgressSegment,
} from "@/components/accelerator/accelerator-progress-segments"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { WorkspaceTutorialCallout } from "@/components/workspace/workspace-tutorial-callout"
import { WORKSPACE_TUTORIAL_INVERSE_TOOLTIP_CLASSNAME } from "@/components/workspace/workspace-tutorial-theme"
import { cn } from "@/lib/utils"

import {
  buildWorkspaceAcceleratorFullscreenHref,
  isWorkspaceAcceleratorChecklistModuleComplete,
  type WorkspaceAcceleratorChecklistModule,
} from "../lib"
import type {
  WorkspaceAcceleratorCardStep,
  WorkspaceAcceleratorTutorialCallout,
  WorkspaceAcceleratorTutorialInteractionPolicy,
} from "../types"
import {
  canWorkspaceAcceleratorTutorialActivateStep,
  canWorkspaceAcceleratorTutorialToggleModule,
} from "./workspace-accelerator-card-tutorial-guards"

const WORKSPACE_ACCELERATOR_CHECKLIST_SOURCE =
  "src/features/workspace-accelerator-card/components/workspace-accelerator-card-checklist.tsx"
const WORKSPACE_ACCELERATOR_CHECKLIST_STEP_ROW_CLASSNAME =
  "group -mx-1 rounded-xl border border-transparent transition-[background-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
const WORKSPACE_ACCELERATOR_CHECKLIST_STEP_TRIGGER_CLASSNAME =
  "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground transition-[background-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none motion-reduce:transition-none hover:bg-muted/50 focus-visible:ring-ring/50 focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-60"
const WORKSPACE_ACCELERATOR_CHECKLIST_STEP_BODY_CLASSNAME =
  "grid transition-[grid-template-rows,opacity] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
const WORKSPACE_ACCELERATOR_CHECKLIST_STATUS_BADGE_CLASSNAME =
  "h-7 rounded-full border-transparent px-2.5 py-1 leading-none"
const WORKSPACE_ACCELERATOR_CHECKLIST_ACTIVE_STATUS_BADGE_CLASSNAME =
  "bg-primary/10 text-primary"

function resolveWorkspaceAcceleratorChecklistStepIcon(
  stepKind: WorkspaceAcceleratorCardStep["stepKind"]
) {
  if (stepKind === "video") return VideoIcon
  if (stepKind === "resources") return FileTextIcon
  if (stepKind === "assignment") return ClipboardListIcon
  if (stepKind === "complete") return CircleCheckIcon
  return BookOpenIcon
}

type WorkspaceAcceleratorCardChecklistProps = {
  modules: WorkspaceAcceleratorChecklistModule[]
  currentStepId: string
  completedStepIds: string[]
  openModuleId: string | null
  onOpenModuleIdChange: (next: string | null) => void
  onStepSelect: (step: WorkspaceAcceleratorCardStep) => void
  tutorialCallout?: WorkspaceAcceleratorTutorialCallout | null
  tutorialTargetStepId?: string | null
  tutorialInteractionPolicy?: WorkspaceAcceleratorTutorialInteractionPolicy | null
  headerControls?: ReactNode
}

export function shouldWorkspaceAcceleratorTutorialRestrictLessonSelection({
  tutorialInteractionPolicy,
}: {
  tutorialInteractionPolicy?: WorkspaceAcceleratorTutorialInteractionPolicy | null
}) {
  return tutorialInteractionPolicy?.stepId === "accelerator-first-module"
}

export function canWorkspaceAcceleratorTutorialSelectLessonStep({
  tutorialInteractionPolicy,
  stepId,
  moduleId,
}: {
  tutorialInteractionPolicy?: WorkspaceAcceleratorTutorialInteractionPolicy | null
  stepId: string
  moduleId: string
}) {
  return canWorkspaceAcceleratorTutorialActivateStep({
    tutorialInteractionPolicy,
    stepId,
    moduleId,
  })
}

function resolveChecklistModuleActionLabel({
  isCompletedChecklistModule,
  isCurrentChecklistModule,
}: {
  isCompletedChecklistModule: boolean
  isCurrentChecklistModule: boolean
}) {
  if (isCompletedChecklistModule) return "Review"
  if (isCurrentChecklistModule) return "Continue"
  return "Start"
}

function resolveChecklistModuleStatusBadge({
  isCompletedChecklistModule,
  isCurrentChecklistModule,
  module,
}: {
  isCompletedChecklistModule: boolean
  isCurrentChecklistModule: boolean
  module: WorkspaceAcceleratorChecklistModule
}) {
  if (isCompletedChecklistModule) {
    return {
      label: "Complete",
      variant: "outline" as const,
      className: WORKSPACE_ACCELERATOR_CHECKLIST_ACTIVE_STATUS_BADGE_CLASSNAME,
      icon: CheckIcon,
    }
  }

  if (
    isCurrentChecklistModule ||
    module.completedStepCount > 0 ||
    module.steps.some((moduleStep) => moduleStep.status === "in_progress")
  ) {
    return {
      label: "In progress",
      variant: "outline" as const,
      className: WORKSPACE_ACCELERATOR_CHECKLIST_ACTIVE_STATUS_BADGE_CLASSNAME,
      icon: null,
    }
  }

  return {
    label: "Not started",
    variant: "secondary" as const,
    className: null,
    icon: null,
  }
}

export function resolveWorkspaceAcceleratorChecklistSelectableStep({
  fallbackStep,
  isTutorialTarget,
  module,
  tutorialTargetStepId,
}: {
  fallbackStep: WorkspaceAcceleratorCardStep
  isTutorialTarget: boolean
  module: WorkspaceAcceleratorChecklistModule
  tutorialTargetStepId: string | null
}) {
  if (!isTutorialTarget || !tutorialTargetStepId) return fallbackStep

  return (
    module.steps.find((moduleStep) => moduleStep.id === tutorialTargetStepId) ??
    fallbackStep
  )
}

function ChecklistStepRow({
  completedStepIds,
  currentStepId,
  module,
  onOpenModuleIdChange,
  onStepSelect,
  openModuleId,
  step,
  tutorialCallout,
  tutorialInteractionPolicy,
  tutorialTargetStepId,
}: {
  completedStepIds: string[]
  currentStepId: string
  module: WorkspaceAcceleratorChecklistModule
  onOpenModuleIdChange: (next: string | null) => void
  onStepSelect: (step: WorkspaceAcceleratorCardStep) => void
  openModuleId: string | null
  step: WorkspaceAcceleratorCardStep
  tutorialCallout: WorkspaceAcceleratorTutorialCallout | null
  tutorialInteractionPolicy?: WorkspaceAcceleratorTutorialInteractionPolicy | null
  tutorialTargetStepId: string | null
}) {
  const primaryStep = module.steps[0] ?? step
  const currentModuleStep =
    module.steps.find((moduleStep) => moduleStep.id === currentStepId) ?? null
  const isCurrentChecklistStep = module.steps.some(
    (moduleStep) => moduleStep.id === currentStepId
  )
  const isCompletedChecklistStep =
    isWorkspaceAcceleratorChecklistModuleComplete({
      module,
      completedStepIds,
    })
  const isTutorialTarget =
    tutorialCallout !== null &&
    module.steps.some((moduleStep) => tutorialTargetStepId === moduleStep.id)
  const selectableStep = resolveWorkspaceAcceleratorChecklistSelectableStep({
    fallbackStep: currentModuleStep ?? primaryStep,
    isTutorialTarget,
    module,
    tutorialTargetStepId,
  })
  const canSelectStep = canWorkspaceAcceleratorTutorialSelectLessonStep({
    tutorialInteractionPolicy,
    stepId: selectableStep.id,
    moduleId: selectableStep.moduleId,
  })
  const canToggleModule = canWorkspaceAcceleratorTutorialToggleModule({
    tutorialInteractionPolicy,
    moduleId: module.id,
  })
  const expanded = openModuleId === module.id
  const actionLabel = resolveChecklistModuleActionLabel({
    isCompletedChecklistModule: isCompletedChecklistStep,
    isCurrentChecklistModule: isCurrentChecklistStep,
  })
  const statusBadge = resolveChecklistModuleStatusBadge({
    isCompletedChecklistModule: isCompletedChecklistStep,
    isCurrentChecklistModule: isCurrentChecklistStep,
    module,
  })
  const StatusIcon = statusBadge.icon
  const reactGrabOwnerId = `workspace-accelerator-checklist:${primaryStep.id}`
  const StepIcon = resolveWorkspaceAcceleratorChecklistStepIcon(
    primaryStep.stepKind
  )
  const progressSegment = resolveAcceleratorModuleProgressSegment({
    moduleSequenceIndex: primaryStep.moduleSequenceIndex,
    moduleSequenceTotal: primaryStep.moduleSequenceTotal,
  })
  const progressSegmentVisual =
    ACCELERATOR_PROGRESS_SEGMENT_VISUALS[progressSegment]
  const hasProgressIconBackground =
    isCurrentChecklistStep || isCompletedChecklistStep || expanded
  const detailsId = `workspace-accelerator-checklist-details-${module.id}`
  const rowClassName = cn(
    WORKSPACE_ACCELERATOR_CHECKLIST_STEP_ROW_CLASSNAME,
    expanded && "bg-muted/55",
    isTutorialTarget &&
      "border-sky-300/70 bg-sky-50/78 shadow-[0_12px_28px_-26px_rgba(14,165,233,0.65)] dark:border-sky-400/50 dark:bg-sky-500/10",
    !canSelectStep && tutorialInteractionPolicy && "opacity-84"
  )
  const row = (
    <div
      {...getReactGrabOwnerProps({
        ownerId: reactGrabOwnerId,
        component: "WorkspaceAcceleratorChecklistStepRow",
        source: WORKSPACE_ACCELERATOR_CHECKLIST_SOURCE,
        slot: "lesson-row",
        variant: step.stepKind,
      })}
      data-state={expanded ? "open" : "closed"}
      className={rowClassName}
    >
      <button
        type="button"
        disabled={!canToggleModule}
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => onOpenModuleIdChange(expanded ? null : module.id)}
        className={WORKSPACE_ACCELERATOR_CHECKLIST_STEP_TRIGGER_CLASSNAME}
      >
        <span
          className={cn(
            "text-muted-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-full",
            hasProgressIconBackground && progressSegmentVisual.fillClassName
          )}
          data-progress-segment={progressSegment}
          aria-hidden
        >
          <StepIcon
            className={cn(
              "size-4",
              hasProgressIconBackground
                ? "text-white"
                : progressSegmentVisual.iconClassName
            )}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center justify-between gap-3">
            <span className="min-w-0 flex-1 truncate">{module.title}</span>
            <Badge
              variant={statusBadge.variant}
              className={cn(
                WORKSPACE_ACCELERATOR_CHECKLIST_STATUS_BADGE_CLASSNAME,
                statusBadge.className
              )}
            >
              {StatusIcon ? <StatusIcon aria-hidden /> : null}
              {statusBadge.label}
            </Badge>
          </span>
        </span>
      </button>
      <div
        id={detailsId}
        aria-hidden={!expanded}
        className={cn(
          WORKSPACE_ACCELERATOR_CHECKLIST_STEP_BODY_CLASSNAME,
          expanded
            ? "grid-rows-[1fr] opacity-100"
            : "pointer-events-none grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 px-3 pb-3">
            <span aria-hidden />
            <div
              className={cn(
                "flex min-w-0 flex-col gap-2 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                expanded ? "translate-y-0" : "-translate-y-1"
              )}
            >
              <p className="text-muted-foreground text-sm leading-snug">
                {selectableStep.stepDescription}
              </p>
              <div className="flex w-full flex-wrap items-center gap-2">
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className="ml-auto rounded-full aria-disabled:pointer-events-none aria-disabled:opacity-50"
                >
                  <Link
                    href={buildWorkspaceAcceleratorFullscreenHref({ stepId: selectableStep.id, moduleId: selectableStep.moduleId })}
                    aria-disabled={!expanded || !canSelectStep}
                    tabIndex={!expanded || !canSelectStep ? -1 : undefined}
                    onClick={(event) => {
                      if (!expanded || !canSelectStep) { event.preventDefault(); return }
                      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                      event.preventDefault()
                      onStepSelect(selectableStep)
                    }}
                  >
                  {actionLabel}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (tutorialCallout && isTutorialTarget) {
    return (
      <div className="relative flex flex-col gap-2">
        <WorkspaceTutorialCallout
          reactGrabOwnerId={`workspace-accelerator-checklist-callout:${step.id}`}
          mode="indicator"
          tooltipContentClassName={WORKSPACE_TUTORIAL_INVERSE_TOOLTIP_CLASSNAME}
          indicatorAnchorAlign="end"
          indicatorAnchorVerticalAlign="center"
          indicatorSide="right"
        />
        {row}
      </div>
    )
  }

  return row
}

export function WorkspaceAcceleratorCardChecklist({
  modules,
  currentStepId,
  completedStepIds,
  openModuleId,
  onOpenModuleIdChange,
  onStepSelect,
  tutorialCallout = null,
  tutorialTargetStepId = null,
  tutorialInteractionPolicy = null,
  headerControls = null,
}: WorkspaceAcceleratorCardChecklistProps) {
  return (
    <div className="flex flex-col gap-2">
      {headerControls ? (
        <div className="max-w-full min-w-0 pb-1">{headerControls}</div>
      ) : null}

      <div className="flex flex-col gap-1 px-1">
        {modules.flatMap((module, index) => {
          const firstStep = module.steps[0]
          if (!firstStep) return []

          const row = (
            <ChecklistStepRow
              key={module.id}
              completedStepIds={completedStepIds}
              currentStepId={currentStepId}
              module={module}
              onOpenModuleIdChange={onOpenModuleIdChange}
              onStepSelect={onStepSelect}
              openModuleId={openModuleId}
              step={firstStep}
              tutorialCallout={tutorialCallout}
              tutorialInteractionPolicy={tutorialInteractionPolicy}
              tutorialTargetStepId={tutorialTargetStepId}
            />
          )

          if (index >= modules.length - 1) return [row]

          return [
            row,
            <Separator
              key={`${module.id}:separator`}
              className="border-border/70 border-t border-dashed bg-transparent"
            />,
          ]
        })}
      </div>
    </div>
  )
}
