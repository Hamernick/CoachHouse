"use client"

import CheckIcon from "lucide-react/dist/esm/icons/check"
import ChevronLeftIcon from "lucide-react/dist/esm/icons/chevron-left"
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right"
import XIcon from "lucide-react/dist/esm/icons/x"
import { useLayoutEffect, useState, type ReactNode } from "react"

import { ModuleRightRail } from "@/components/training/module-right-rail"
import type { ModuleResource } from "@/components/training/types"
import { Button } from "@/components/ui/button"
import { WorkspaceTutorialCallout } from "@/components/workspace/workspace-tutorial-callout"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

import type {
  WorkspaceAcceleratorCardStep,
  WorkspaceAcceleratorTutorialCallout,
  WorkspaceAcceleratorTutorialInteractionPolicy,
} from "../types"
import {
  resolveWorkspaceAcceleratorDisplayStepTitle,
  shouldShowWorkspaceAcceleratorModuleTitle,
} from "./workspace-accelerator-step-node-card-helpers"
import { WorkspaceAcceleratorStepInlineHeader } from "./workspace-accelerator-step-inline-header"
import { WorkspaceAcceleratorStepLayout } from "./workspace-accelerator-step-layout"
import { WorkspaceAcceleratorStepWindowHeader } from "./workspace-accelerator-step-window-header"
import {
  useWorkspaceWindowHeader,
  WORKSPACE_HEADER_BUTTON,
} from "@/components/workspace/workspace-window-header-slots"
import { WorkspaceAcceleratorStepBody } from "./workspace-accelerator-step-node-card-body"
import {
  canWorkspaceAcceleratorTutorialPerformPreviewAction,
  isWorkspaceAcceleratorTutorialPreviewLocked,
} from "./workspace-accelerator-card-tutorial-guards"
import {
  resolveAssignmentFooterNavigation,
  WorkspaceAcceleratorStepFooter,
} from "./workspace-accelerator-step-node-card-footer"
import { WorkspaceAcceleratorTutorialGuardTooltip } from "./workspace-accelerator-tutorial-guard-tooltip"
import { useWorkspaceAcceleratorTutorialGuard } from "./use-workspace-accelerator-tutorial-guard"

type WorkspaceAcceleratorStepNodeCardVariant = "node" | "embedded"

export type WorkspaceAcceleratorStepNodeCardProps = {
  step: WorkspaceAcceleratorCardStep
  placeholderVideoUrl?: string | null
  stepIndex: number
  stepTotal: number
  canGoPrevious: boolean
  canGoNext: boolean
  completed: boolean
  moduleCompleted: boolean
  onPrevious: () => void
  onNext: () => void
  onVideoComplete?: () => void
  onComplete: () => void
  onClose: () => void
  onNavigateOverview?: (moduleId: string | null) => void
  tutorialCallout?: WorkspaceAcceleratorTutorialCallout | null
  tutorialInteractionPolicy?: WorkspaceAcceleratorTutorialInteractionPolicy | null
  variant?: WorkspaceAcceleratorStepNodeCardVariant
  sidePanel?: ReactNode
  drawerContainer?: HTMLElement | null
  onWorkspaceOnboardingSubmit?: (form: FormData) => Promise<void>
  immersive?: boolean
}

function headerButtonClassName() {
  return "h-9 w-9 touch-manipulation rounded-lg border border-border/65 bg-background/80 hover:bg-background/95 lg:h-8 lg:w-8"
}

function headerDoneButtonClassName() {
  return "h-9 min-w-[76px] touch-manipulation gap-1.5 rounded-full bg-background/90 px-3 text-xs font-medium text-foreground shadow-none hover:bg-muted/70 hover:text-foreground lg:h-8 lg:min-w-[72px] sm:px-3 dark:bg-background/75 dark:hover:bg-muted/45"
}

function clampStepTitle(title: string) {
  const trimmed = title.trim()
  if (!trimmed) return "Accelerator step"
  return trimmed
}

function normalizeRailResources(
  step: WorkspaceAcceleratorCardStep
): ModuleResource[] {
  if (step.moduleContext?.moduleResources?.length) {
    return step.moduleContext.moduleResources
  }

  return step.resources.map((resource) => ({
    label: resource.title,
    url: resource.url,
    provider: "generic" as const,
  }))
}

function AcceleratorStepCloseButton({
  done,
  compact,
  moduleCompleted,
  onClose,
  tutorialCallout,
  variant,
  inWindow = false,
}: {
  done?: boolean
  compact: boolean
  moduleCompleted: boolean
  onClose: () => void
  tutorialCallout: WorkspaceAcceleratorTutorialCallout | null
  variant: WorkspaceAcceleratorStepNodeCardVariant
  inWindow?: boolean
}) {
  const button = (
    <Button
      type="button"
      size={done ? "sm" : "icon"}
      variant="ghost"

      className={cn(
        inWindow
          ? done
            ? WORKSPACE_HEADER_BUTTON
            : "size-7 rounded-full [@media(pointer:coarse)]:size-11"
          : done
            ? headerDoneButtonClassName()
            : headerButtonClassName(),
        !inWindow &&
          (compact
            ? done
              ? "h-11 lg:h-11"
              : "h-11 w-11 lg:h-11 lg:w-11"
            : done
              ? "h-8"
              : "h-8 w-8"),
        !done &&
          moduleCompleted &&
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
      )}
      onClick={onClose}
      aria-label={
        done
          ? "Done reviewing this lesson"
          : moduleCompleted
            ? "Lesson complete"
            : variant === "embedded"
              ? "Close accelerator lesson"
              : "Close accelerator step node"
      }
    >
      {done ? (
        <>
          <CheckIcon
            className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          <span>Done</span>
        </>
      ) : moduleCompleted ? (
        <CheckIcon className="h-4 w-4" aria-hidden />
      ) : (
        <XIcon className="h-4 w-4" aria-hidden />
      )}
    </Button>
  )

  if (tutorialCallout?.focus !== "close-module") {
    return button
  }

  return (
    <div className="relative inline-flex shrink-0">
      <WorkspaceTutorialCallout
        calloutId="workspace-accelerator-step-node-card:close-module-callout"
        mode="indicator"
        indicatorOffsetY={-12}
      />
      {button}
    </div>
  )
}

// eslint-disable-next-line max-lines-per-function
export function WorkspaceAcceleratorStepNodeCard({
  step,
  placeholderVideoUrl = null,
  stepIndex,
  stepTotal,
  canGoPrevious,
  canGoNext,
  completed,
  moduleCompleted,
  onPrevious,
  onNext,
  onComplete,
  onVideoComplete,
  onClose,
  onNavigateOverview,
  tutorialCallout = null,
  tutorialInteractionPolicy = null,
  variant = "node",
  sidePanel,
  drawerContainer = null,
  onWorkspaceOnboardingSubmit,
  immersive = false,
}: WorkspaceAcceleratorStepNodeCardProps) {
  const embedded = variant === "embedded"
  const windowHeaderEnabled = useWorkspaceWindowHeader()
  const inWindow = Boolean(drawerContainer) && windowHeaderEnabled
  const isMobileViewport = useIsMobile(1024)
  const [compactDrawer, setCompactDrawer] = useState(true)
  useLayoutEffect(() => {
    if (!drawerContainer) return
    const update = () => {
      const width = drawerContainer.clientWidth
      if (width > 0) setCompactDrawer(width < 960)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(drawerContainer)
    return () => observer.disconnect()
  }, [drawerContainer])
  const isMobile = drawerContainer ? compactDrawer : isMobileViewport
  const previewLocked = isWorkspaceAcceleratorTutorialPreviewLocked({
    tutorialInteractionPolicy,
  })
  const previewGuard = useWorkspaceAcceleratorTutorialGuard({
    enabled: previewLocked,
    defaultMessage:
      tutorialInteractionPolicy?.blockedMessage ??
      "We'll go over this soon, I promise! :)",
    durationMs: tutorialInteractionPolicy?.blockedMessageDurationMs ?? 3000,
  })
  const [blockedControlId, setBlockedControlId] = useState<string | null>(null)
  const stepTitle = clampStepTitle(
    step.stepKind === "assignment" && step.moduleTitle.trim()
      ? step.moduleTitle
      : resolveWorkspaceAcceleratorDisplayStepTitle({
          moduleTitle: step.moduleTitle,
          stepTitle: step.stepTitle,
        })
  )
  const showModuleTitle =
    step.stepKind !== "assignment" &&
    shouldShowWorkspaceAcceleratorModuleTitle({
      moduleTitle: step.moduleTitle,
      stepTitle,
    })
  const stepCount = Math.max(stepTotal, 1)
  const currentCount = Math.min(stepIndex + 1, stepCount)
  const workspaceOnboardingView =
    step.moduleContext?.workspaceOnboarding?.view ?? null
  const fullscreenEmbedded = embedded && immersive
  const immersiveOnboarding =
    fullscreenEmbedded && workspaceOnboardingView === "organization-setup"
  const handleBlockedPreviewAction = (
    action:
      | "preview-navigation"
      | "preview-close"
      | "preview-link"
      | "preview-submit",
    controlId: string
  ) => {
    setBlockedControlId(controlId)
    previewGuard.showBlockedFeedback(action)
  }
  const canNavigatePreview =
    canWorkspaceAcceleratorTutorialPerformPreviewAction({
      tutorialInteractionPolicy,
      action: "preview-navigation",
    })
  const canClosePreview = canWorkspaceAcceleratorTutorialPerformPreviewAction({
    tutorialInteractionPolicy,
    action: "preview-close",
  })

  const navigationControls = (
    <>
      <WorkspaceAcceleratorTutorialGuardTooltip
        open={previewGuard.open && blockedControlId === "previous"}
        message={previewGuard.message}

        side="top"
        align="end"
        sideOffset={8}
      >
        <Button
          type="button"
          size="icon"
          variant="ghost"

          className={cn(
            inWindow
              ? "size-7 rounded-full [@media(pointer:coarse)]:size-11"
              : headerButtonClassName(),
            !inWindow &&
              (drawerContainer
                ? isMobile
                  ? "h-11 w-11 lg:h-11 lg:w-11"
                  : "h-9 w-9 lg:h-9 lg:w-9"
                : "h-9 w-9 sm:h-7 sm:w-7")
          )}
          onClick={() => {
            if (canNavigatePreview) {
              onPrevious()
              return
            }
            handleBlockedPreviewAction("preview-navigation", "previous")
          }}
          disabled={!canGoPrevious}
          aria-label="Previous accelerator step"
        >
          <ChevronLeftIcon className="h-4 w-4" aria-hidden />
        </Button>
      </WorkspaceAcceleratorTutorialGuardTooltip>
      <span className="text-foreground shrink-0 px-1 text-[11px] font-medium tabular-nums">
        {currentCount} of {stepCount}
      </span>
      <WorkspaceAcceleratorTutorialGuardTooltip
        open={previewGuard.open && blockedControlId === "next"}
        message={previewGuard.message}

        side="top"
        align="end"
        sideOffset={8}
      >
        <Button
          type="button"
          size="icon"
          variant="ghost"

          className={cn(
            inWindow
              ? "size-7 rounded-full [@media(pointer:coarse)]:size-11"
              : headerButtonClassName(),
            !inWindow &&
              (drawerContainer
                ? isMobile
                  ? "h-11 w-11 lg:h-11 lg:w-11"
                  : "h-9 w-9 lg:h-9 lg:w-9"
                : "h-9 w-9 sm:h-7 sm:w-7")
          )}
          onClick={() => {
            if (canNavigatePreview) {
              onNext()
              return
            }
            handleBlockedPreviewAction("preview-navigation", "next")
          }}
          disabled={!canGoNext}
          aria-label="Next accelerator step"
        >
          <ChevronRightIcon className="h-4 w-4" aria-hidden />
        </Button>
      </WorkspaceAcceleratorTutorialGuardTooltip>
    </>
  )
  const closeControl = (
    <WorkspaceAcceleratorTutorialGuardTooltip
      open={previewGuard.open && blockedControlId === "close"}
      message={previewGuard.message}

      side="top"
      align="end"
      sideOffset={8}
    >
      <div className="inline-flex">
        <AcceleratorStepCloseButton
          compact={isMobile}
          inWindow={inWindow}
          done={!canGoNext && !workspaceOnboardingView}
          moduleCompleted={moduleCompleted}
          onClose={() => {
            if (canClosePreview) {
              if (!canGoNext && !workspaceOnboardingView) onComplete()
              else onClose()
              return
            }
            handleBlockedPreviewAction("preview-close", "close")
          }}

          tutorialCallout={tutorialCallout}
          variant={variant}
        />
      </div>
    </WorkspaceAcceleratorTutorialGuardTooltip>
  )
  const resolvedSidePanel =
    sidePanel ??
    (embedded && !workspaceOnboardingView ? (
      <ModuleRightRail
        moduleId={step.moduleId}
        moduleTitle={step.moduleTitle}
        resources={normalizeRailResources(step)}
        hasDeck={step.hasDeck}
        breakAction={{
          kind: "button",
          label: "Close lesson",
          onClick: () => {
            if (canClosePreview) {
              onClose()
              return
            }
            handleBlockedPreviewAction("preview-close", "rail-close")
          },
        }}
      />
    ) : null)
  const stackSidebar = Boolean(resolvedSidePanel) && isMobile
  const assignmentFooterNavigation = resolveAssignmentFooterNavigation(step)
  const isFinalAssignmentSection = Boolean(
    assignmentFooterNavigation && !assignmentFooterNavigation.nextSection
  )
  const stepBody = (
    <WorkspaceAcceleratorStepBody
      step={step}
      placeholderVideoUrl={placeholderVideoUrl}
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      canGoNext={canGoNext}
      completed={completed}
      onVideoComplete={onVideoComplete}
      onComplete={onComplete}
      onClose={onClose}
      tutorialInteractionPolicy={tutorialInteractionPolicy}
      onBlockedPreviewAction={handleBlockedPreviewAction}
      onWorkspaceOnboardingSubmit={onWorkspaceOnboardingSubmit}
      immersiveOnboarding={immersiveOnboarding}
      fitVideo={Boolean(drawerContainer) && !stackSidebar}
    />
  )
  return (
    <WorkspaceAcceleratorStepLayout
      drawerContainer={drawerContainer}
      stepId={step.id}
      embedded={embedded}
      fullscreen={fullscreenEmbedded}
      fillBody={
        !stackSidebar &&
        (immersiveOnboarding ||
          step.stepKind === "assignment" ||
          (Boolean(drawerContainer) && step.stepKind === "video"))
      }
      showCallout={tutorialCallout?.focus === "close-module"}
      header={
        !immersiveOnboarding ? (
          inWindow ? (
            <WorkspaceAcceleratorStepWindowHeader
              step={step}
              stepTitle={stepTitle}
              actions={
                <>
                  {navigationControls}
                  {closeControl}
                </>
              }
              onOverview={() => {
                if (canClosePreview) {
                  onClose()
                  onNavigateOverview?.(null)
                } else handleBlockedPreviewAction("preview-close", "close")
              }}
              onModuleOverview={() => {
                if (canClosePreview) {
                  onClose()
                  onNavigateOverview?.(step.moduleId)
                } else handleBlockedPreviewAction("preview-close", "close")
              }}
            />
          ) : (
            <WorkspaceAcceleratorStepInlineHeader
              embedded={embedded}
              inDrawer={Boolean(drawerContainer)}
              stackSidebar={stackSidebar}
              closeFocused={tutorialCallout?.focus === "close-module"}
              showModuleTitle={showModuleTitle}
              moduleTitle={step.moduleTitle}
              stepTitle={stepTitle}
              isMobile={isMobile}
              navigationControls={navigationControls}
              closeControl={closeControl}
            />
          )
        ) : null
      }
      sidebar={resolvedSidePanel}
      stackSidebar={stackSidebar}
      footer={
        !immersiveOnboarding && assignmentFooterNavigation ? (
          <WorkspaceAcceleratorStepFooter
            assignmentFooterNavigation={assignmentFooterNavigation}
            canGoNext={canGoNext}
            canGoPrevious={canGoPrevious}
            completed={completed}
            isFinalAssignmentSection={isFinalAssignmentSection}
            onComplete={onComplete}
            onNext={onNext}
            onPrevious={onPrevious}
          />
        ) : null
      }
    >
      {stepBody}
    </WorkspaceAcceleratorStepLayout>
  )
}
