"use client"

import Link from "next/link"
import { useEffect, useRef, type ReactNode } from "react"

import { RightRailSlot } from "@/components/app-shell/right-rail"
import { RoadmapNavigatorDropdown } from "@/components/roadmap/roadmap-navigator-dropdown"
import { RoadmapNavigatorSection } from "@/components/roadmap/roadmap-navigator-section"
import { Button } from "@/components/ui/button"
import type { RoadmapSection } from "@/lib/roadmap"
import { cn } from "@/lib/utils"

import {
  buildWorkspaceAcceleratorChecklistModules,
  buildWorkspaceAcceleratorLessonGroupOptions,
} from "../lib"
import type {
  WorkspaceAcceleratorCardInput,
  WorkspaceAcceleratorLessonGroupSummary,
  WorkspaceAcceleratorCardStep,
  WorkspaceAcceleratorTutorialCallout,
  WorkspaceAcceleratorTutorialInteractionPolicy,
} from "../types"
import { WorkspaceAcceleratorCardChecklist } from "./workspace-accelerator-card-checklist"
import {
  WorkspaceAcceleratorCardProgressStrip,
  WorkspaceAcceleratorCardProgressSummary,
} from "./workspace-accelerator-card-progress-strip"
import { WorkspaceAcceleratorHeaderPicker } from "./workspace-accelerator-header-picker"

export { WorkspaceAcceleratorHeaderPicker } from "./workspace-accelerator-header-picker"
export { resolveWorkspaceAcceleratorHeaderPickerScrollDistance } from "./workspace-accelerator-header-picker-overflow"

type WorkspaceAcceleratorCardSidebarProps = {
  className?: string
  selectedLessonGroup:
    | ReturnType<typeof buildWorkspaceAcceleratorLessonGroupOptions>[number]
    | null
  tutorialCallout: WorkspaceAcceleratorTutorialCallout | null
  tutorialInteractionPolicy?: WorkspaceAcceleratorTutorialInteractionPolicy | null
  filteredProgressPercent: number
  readinessSummary: WorkspaceAcceleratorCardInput["readinessSummary"]
  showMilestoneTooltips?: boolean
  checklistModules: ReturnType<typeof buildWorkspaceAcceleratorChecklistModules>
  currentStepId: string
  completedStepIds: string[]
  openModuleId: string | null
  onOpenModuleIdChange: (next: string | null) => void
  onStepSelect: (step: WorkspaceAcceleratorCardStep) => void
  tutorialTargetStepId: string | null
  headerControls?: ReactNode
  checklistHeaderControls?: ReactNode
  showProgressSummary?: boolean
  showChecklist?: boolean
  fillAvailableHeight?: boolean
}

export function WorkspaceAcceleratorCardInlinePicker({
  lessonGroupOptions,
  selectedLessonGroupKey,
  tutorialCallout,
  tutorialInteractionPolicy,
  viewerOpen,
  layout = "rail",
  onLessonGroupChange,
}: {
  lessonGroupOptions: WorkspaceAcceleratorLessonGroupSummary[]
  selectedLessonGroupKey: string
  tutorialCallout: WorkspaceAcceleratorTutorialCallout | null
  tutorialInteractionPolicy?: WorkspaceAcceleratorTutorialInteractionPolicy | null
  viewerOpen: boolean
  layout?: "rail" | "badge"
  onLessonGroupChange: (nextLessonGroupKey: string) => void
}) {
  return (
    <div
      className={cn(
        layout === "badge"
          ? "inline-flex min-w-0 max-w-72 items-start"
          : "flex w-full items-start"
      )}
    >
      <div className={cn("min-w-0", layout === "badge" ? "" : "flex-1")}>
        <WorkspaceAcceleratorHeaderPicker
          lessonGroupOptions={lessonGroupOptions}
          selectedLessonGroupKey={selectedLessonGroupKey}
          tutorialCallout={
            tutorialCallout?.focus === "picker" ? tutorialCallout : null
          }
          tutorialInteractionPolicy={tutorialInteractionPolicy ?? null}
          viewerOpen={viewerOpen}
          layout={layout}
          onLessonGroupChange={onLessonGroupChange}
        />
      </div>
    </div>
  )
}

export function WorkspaceAcceleratorDrawerHeaderControls({
  filteredProgressPercent,
  lessonGroupOptions,
  onLessonGroupChange,
  readinessSummary,
  roadmapSections = [],
  roadmapBasePath,
  roadmapReturnTo,
  selectedLessonGroupKey,
  showMilestoneTooltips = true,
  showPicker = true,
  tutorialCallout,
  tutorialInteractionPolicy,
  viewerOpen,
}: {
  filteredProgressPercent: number
  lessonGroupOptions: WorkspaceAcceleratorLessonGroupSummary[]
  onLessonGroupChange: (nextLessonGroupKey: string) => void
  readinessSummary: WorkspaceAcceleratorCardInput["readinessSummary"]
  roadmapSections?: RoadmapSection[]
  roadmapBasePath?: string
  roadmapReturnTo?: string
  selectedLessonGroupKey: string
  showMilestoneTooltips?: boolean
  showPicker?: boolean
  tutorialCallout: WorkspaceAcceleratorTutorialCallout | null
  tutorialInteractionPolicy?: WorkspaceAcceleratorTutorialInteractionPolicy | null
  viewerOpen: boolean
}) {
  return (
    <div
      data-workspace-accelerator-drawer-header-controls="true"
      className="flex w-full min-w-0 flex-col gap-3 py-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6"
    >
      <WorkspaceAcceleratorCardProgressSummary
        progressPercent={filteredProgressPercent}
        readinessSummary={readinessSummary}
        tutorialCallout={
          tutorialCallout?.focus === "progress" ? tutorialCallout : null
        }
        showMilestoneTooltips={showMilestoneTooltips}
        className="min-w-0 sm:max-w-lg sm:flex-1"
      />
      {showPicker ? (
        <div className="flex min-w-0 max-w-full items-center justify-end gap-2 sm:max-w-[70%] sm:self-end">
          <RoadmapNavigatorDropdown sections={roadmapSections} basePath={roadmapBasePath} returnTo={roadmapReturnTo} />
          <WorkspaceAcceleratorCardInlinePicker
            lessonGroupOptions={lessonGroupOptions}
            selectedLessonGroupKey={selectedLessonGroupKey}
            tutorialCallout={tutorialCallout}
            tutorialInteractionPolicy={tutorialInteractionPolicy ?? null}
            viewerOpen={viewerOpen}
            layout="badge"
            onLessonGroupChange={onLessonGroupChange}
          />
        </div>
      ) : null}
    </div>
  )
}

export function WorkspaceAcceleratorCardEmptyState({ href }: { href: string }) {
  return (
    <div className="flex min-h-0 flex-col gap-3 pb-1">
      <div className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Accelerator classes will appear here once your roadmap is ready.
        </p>
      </div>
      <Button
        asChild
        size="sm"
        variant="outline"
        className="self-start rounded-xl text-xs"
      >
        <Link href={href}>Open accelerator</Link>
      </Button>
    </div>
  )
}

export function useModuleViewerSizeSync({
  size,
  onSizeChange,
  isModuleViewerOpen,
  enabled = true,
}: {
  size: WorkspaceAcceleratorCardInput["size"]
  onSizeChange: WorkspaceAcceleratorCardInput["onSizeChange"]
  isModuleViewerOpen: boolean
  enabled?: boolean
}) {
  const collapsedSizeBeforeViewerRef = useRef<
    WorkspaceAcceleratorCardInput["size"] | null
  >(null)

  useEffect(() => {
    if (!onSizeChange) return

    if (!enabled) {
      const previousCollapsedSize = collapsedSizeBeforeViewerRef.current
      collapsedSizeBeforeViewerRef.current = null
      if (previousCollapsedSize && size !== previousCollapsedSize) {
        onSizeChange(previousCollapsedSize)
      }
      return
    }

    if (isModuleViewerOpen) {
      if (collapsedSizeBeforeViewerRef.current === null) {
        collapsedSizeBeforeViewerRef.current = size
      }
      if (size !== "lg") {
        onSizeChange("lg")
      }
      return
    }

    const previousCollapsedSize = collapsedSizeBeforeViewerRef.current
    if (!previousCollapsedSize) {
      const fallbackCollapsedSize =
        resolveWorkspaceAcceleratorCollapsedCardSize({
          currentSize: size,
          previousCollapsedSize: null,
        })
      if (fallbackCollapsedSize !== size) {
        onSizeChange(fallbackCollapsedSize)
      }
      return
    }
    collapsedSizeBeforeViewerRef.current = null
    if (size !== previousCollapsedSize) {
      onSizeChange(previousCollapsedSize)
    }
  }, [enabled, isModuleViewerOpen, onSizeChange, size])
}

export function resolveWorkspaceAcceleratorCollapsedCardSize({
  currentSize,
  previousCollapsedSize,
}: {
  currentSize: WorkspaceAcceleratorCardInput["size"]
  previousCollapsedSize: WorkspaceAcceleratorCardInput["size"] | null
}) {
  if (previousCollapsedSize) {
    return previousCollapsedSize
  }

  return currentSize === "lg" ? "sm" : currentSize
}

export function shouldWorkspaceAcceleratorTutorialKeepModuleViewerOpen({
  tutorialCallout,
  tutorialMode = null,
}: {
  tutorialCallout: WorkspaceAcceleratorTutorialCallout | null
  tutorialMode?: "module-preview" | null
}) {
  return (
    tutorialCallout?.focus === "close-module" ||
    tutorialMode === "module-preview"
  )
}

export function shouldWorkspaceAcceleratorTutorialAdvanceFromFooterContinue(
  tutorialMode?: "module-preview" | null
) {
  return tutorialMode === "module-preview"
}

export function shouldWorkspaceAcceleratorSyncModuleViewerSize({
  tutorialCallout,
  tutorialMode = null,
}: {
  tutorialCallout: WorkspaceAcceleratorTutorialCallout | null
  tutorialMode?: "module-preview" | null
}) {
  return !shouldWorkspaceAcceleratorTutorialKeepModuleViewerOpen({
    tutorialCallout,
    tutorialMode,
  })
}

export function shouldWorkspaceAcceleratorTutorialAdvanceAfterStepOpen({
  tutorialCallout,
  pendingAdvance,
  isModuleViewerOpen,
  currentStepId,
  tutorialTargetStepId,
}: {
  tutorialCallout: WorkspaceAcceleratorTutorialCallout | null
  pendingAdvance: boolean
  isModuleViewerOpen: boolean
  currentStepId: string | null
  tutorialTargetStepId: string | null
}) {
  return (
    pendingAdvance &&
    tutorialCallout?.focus === "first-module" &&
    isModuleViewerOpen &&
    currentStepId !== null &&
    tutorialTargetStepId !== null &&
    currentStepId === tutorialTargetStepId
  )
}

export function completeWorkspaceAcceleratorTutorialPreview({
  setIsModuleViewerOpen,
  previousTutorialManagedViewerOpenRef,
  onTutorialActionComplete,
}: {
  setIsModuleViewerOpen: (open: boolean) => void
  previousTutorialManagedViewerOpenRef: { current: boolean }
  onTutorialActionComplete?: (
    mode?: "complete" | "complete-and-advance"
  ) => void
}) {
  setIsModuleViewerOpen(false)
  previousTutorialManagedViewerOpenRef.current = false
  onTutorialActionComplete?.("complete-and-advance")
}

export function useWorkspaceAcceleratorTutorialViewerState({
  currentModuleId,
  tutorialCallout,
  tutorialMode,
  setIsModuleViewerOpen,
  setOpenModuleId,
  previousTutorialManagedViewerOpenRef,
}: {
  currentModuleId: string | null
  tutorialCallout: WorkspaceAcceleratorTutorialCallout | null
  tutorialMode?: "module-preview" | null
  setIsModuleViewerOpen: (open: boolean) => void
  setOpenModuleId: (
    update: string | null | ((previous: string | null) => string | null)
  ) => void
  previousTutorialManagedViewerOpenRef: { current: boolean }
}) {
  useEffect(() => {
    const shouldKeepTutorialViewerOpen =
      shouldWorkspaceAcceleratorTutorialKeepModuleViewerOpen({
        tutorialCallout,
        tutorialMode,
      })

    if (shouldKeepTutorialViewerOpen) {
      setIsModuleViewerOpen(true)
      setOpenModuleId((previous) =>
        previous === currentModuleId ? previous : currentModuleId
      )
      previousTutorialManagedViewerOpenRef.current = true
      return
    }

    if (previousTutorialManagedViewerOpenRef.current) {
      setIsModuleViewerOpen(false)
      previousTutorialManagedViewerOpenRef.current = false
    }
  }, [
    currentModuleId,
    previousTutorialManagedViewerOpenRef,
    setIsModuleViewerOpen,
    setOpenModuleId,
    tutorialCallout,
    tutorialMode,
  ])
}

export function WorkspaceAcceleratorCardSidebar({
  className,
  selectedLessonGroup,
  tutorialCallout,
  tutorialInteractionPolicy = null,
  filteredProgressPercent,
  readinessSummary,
  showMilestoneTooltips = true,
  checklistModules,
  currentStepId,
  completedStepIds,
  openModuleId,
  onOpenModuleIdChange,
  onStepSelect,
  tutorialTargetStepId,
  headerControls = null,
  checklistHeaderControls = null,
  showProgressSummary = true,
  showChecklist = true,
  fillAvailableHeight = true,
}: WorkspaceAcceleratorCardSidebarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5",
        fillAvailableHeight ? "min-h-full" : "min-h-0",
        className
      )}
    >
      {headerControls ? <div className="w-full">{headerControls}</div> : null}

      {showProgressSummary ? (
        <WorkspaceAcceleratorCardProgressStrip
          progressPercent={filteredProgressPercent}
          readinessSummary={readinessSummary}
          showMilestoneTooltips={showMilestoneTooltips}
          tutorialCallout={
            tutorialCallout?.focus === "progress" ? tutorialCallout : null
          }
        />
      ) : null}

      {showChecklist ? (
        <WorkspaceAcceleratorCardChecklist
          modules={checklistModules}
          currentStepId={currentStepId}
          completedStepIds={completedStepIds}
          openModuleId={openModuleId}
          onOpenModuleIdChange={onOpenModuleIdChange}
          onStepSelect={onStepSelect}
          tutorialCallout={
            tutorialCallout?.focus === "first-module" ? tutorialCallout : null
          }
          tutorialTargetStepId={tutorialTargetStepId}
          tutorialInteractionPolicy={tutorialInteractionPolicy}
          headerControls={checklistHeaderControls}
        />
      ) : null}
    </div>
  )
}

export function WorkspaceAcceleratorCardFullscreenRail({
  lessonGroupOptions,
  selectedLessonGroupKey,
  onLessonGroupChange,
  viewerOpen = false,
  roadmapSections = [],
  roadmapBasePath = "/workspace/roadmap",
  ...sidebarProps
}: WorkspaceAcceleratorCardSidebarProps & {
  lessonGroupOptions: WorkspaceAcceleratorLessonGroupSummary[]
  selectedLessonGroupKey: string
  onLessonGroupChange: (nextLessonGroupKey: string) => void
  viewerOpen?: boolean
  roadmapSections?: RoadmapSection[]
  roadmapBasePath?: string
}) {
  return (
    <RightRailSlot priority={20}>
      <WorkspaceAcceleratorCardFullscreenRailContent
        {...sidebarProps}
        lessonGroupOptions={lessonGroupOptions}
        selectedLessonGroupKey={selectedLessonGroupKey}
        onLessonGroupChange={onLessonGroupChange}
        viewerOpen={viewerOpen}
        roadmapSections={roadmapSections}
        roadmapBasePath={roadmapBasePath}
      />
    </RightRailSlot>
  )
}

export function WorkspaceAcceleratorCardFullscreenRailContent({
  lessonGroupOptions,
  selectedLessonGroupKey,
  onLessonGroupChange,
  viewerOpen = false,
  roadmapSections = [],
  roadmapBasePath = "/workspace/roadmap",
  ...sidebarProps
}: WorkspaceAcceleratorCardSidebarProps & {
  lessonGroupOptions: WorkspaceAcceleratorLessonGroupSummary[]
  selectedLessonGroupKey: string
  onLessonGroupChange: (nextLessonGroupKey: string) => void
  viewerOpen?: boolean
  roadmapSections?: RoadmapSection[]
  roadmapBasePath?: string
}) {
  const hasRoadmap = roadmapSections.length > 0

  if (hasRoadmap) {
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <RoadmapNavigatorSection
            sections={roadmapSections}
            basePath={roadmapBasePath}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <WorkspaceAcceleratorCardSidebar
        {...sidebarProps}
        showChecklist={false}
        headerControls={
          <WorkspaceAcceleratorCardInlinePicker
            lessonGroupOptions={lessonGroupOptions}
            selectedLessonGroupKey={selectedLessonGroupKey}
            tutorialCallout={sidebarProps.tutorialCallout}
            tutorialInteractionPolicy={sidebarProps.tutorialInteractionPolicy}
            viewerOpen={viewerOpen}
            onLessonGroupChange={onLessonGroupChange}
          />
        }
      />
    </div>
  )
}

export function WorkspaceAcceleratorHeaderSummary({
  moduleCount,
  stepCount,
}: {
  moduleCount: number
  stepCount: number
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="border-border/70 bg-background/70 text-muted-foreground inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] leading-none font-medium tabular-nums">
        {moduleCount} {moduleCount === 1 ? "lesson" : "lessons"}
      </span>
      <span className="border-border/70 bg-background/70 text-muted-foreground inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] leading-none font-medium tabular-nums">
        {stepCount} {stepCount === 1 ? "step" : "steps"}
      </span>
    </div>
  )
}
