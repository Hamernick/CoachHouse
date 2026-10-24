"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"
import Layers from "lucide-react/dist/esm/icons/layers"

import {
  ACCELERATOR_PROGRESS_SEGMENT_VISUALS,
  resolveAcceleratorModuleProgressSegment,
} from "@/components/accelerator/accelerator-progress-segments"

import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { WorkspaceTutorialCallout } from "@/components/workspace/workspace-tutorial-callout"
import {
  WORKSPACE_COMPACT_PICKER_CLASSNAME,
  WORKSPACE_TUTORIAL_INVERSE_TOOLTIP_CLASSNAME,
  WORKSPACE_TUTORIAL_NEUTRAL_SURFACE_CLASSNAME,
} from "@/components/workspace/workspace-tutorial-theme"
import { getTrackIcon } from "@/lib/accelerator/track-icons"
import { cn } from "@/lib/utils"

import type {
  WorkspaceAcceleratorLessonGroupSummary,
  WorkspaceAcceleratorTutorialCallout,
  WorkspaceAcceleratorTutorialInteractionPolicy,
} from "../types"
import {
  isWorkspaceAcceleratorTutorialPinnedClassGroup,
  shouldWorkspaceAcceleratorTutorialBlockClassDropdownOpen,
  shouldWorkspaceAcceleratorTutorialBlockClassSelection,
} from "./workspace-accelerator-card-tutorial-guards"
import { WorkspaceAcceleratorTutorialGuardTooltip } from "./workspace-accelerator-tutorial-guard-tooltip"
import { resolveWorkspaceAcceleratorHeaderPickerScrollDistance } from "./workspace-accelerator-header-picker-overflow"
import { useWorkspaceAcceleratorTutorialGuard } from "./use-workspace-accelerator-tutorial-guard"

const WORKSPACE_ACCELERATOR_TUTORIAL_PICKER_TRIGGER_CLASSNAME = cn(
  "h-9 min-h-9 rounded-xl px-3",
  WORKSPACE_TUTORIAL_NEUTRAL_SURFACE_CLASSNAME
)
const WORKSPACE_ACCELERATOR_COMPACT_PICKER_TRIGGER_CLASSNAME =
  "w-[196px] max-w-[48vw]"
const WORKSPACE_ACCELERATOR_EXPANDED_PICKER_TRIGGER_CLASSNAME =
  "w-[248px] max-w-[36vw]"
const WORKSPACE_ACCELERATOR_RAIL_PICKER_TRIGGER_CLASSNAME =
  "w-full max-w-none px-1.5"
const WORKSPACE_ACCELERATOR_BADGE_PICKER_TRIGGER_CLASSNAME =
  WORKSPACE_COMPACT_PICKER_CLASSNAME

function WorkspaceAcceleratorHeaderPickerLabel({ label }: { label: string }) {
  const viewportRef = useRef<HTMLSpanElement | null>(null)
  const contentRef = useRef<HTMLSpanElement | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [scrollDistance, setScrollDistance] = useState(0)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return

    const measure = () => {
      const nextScrollDistance =
        resolveWorkspaceAcceleratorHeaderPickerScrollDistance({
          contentWidth: content.scrollWidth,
          viewportWidth: viewport.clientWidth,
        })
      setScrollDistance(nextScrollDistance)
    }

    measure()

    if (typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(content)

    return () => observer.disconnect()
  }, [label])

  return (
    <span
      ref={viewportRef}
      className="relative min-w-0 flex-1 overflow-hidden"
      data-slot="class-picker-label"
      onPointerEnter={(event) => setIsHovered(event.pointerType === "mouse")}
      onPointerLeave={() => setIsHovered(false)}
    >
      <span
        ref={contentRef}
        className={cn(
          "block min-w-full text-left whitespace-nowrap",
          scrollDistance > 0 && isHovered
            ? "w-max transition-transform duration-1000 ease-out motion-reduce:transition-none"
            : "w-full truncate"
        )}
        style={
          scrollDistance > 0 && isHovered
            ? { transform: `translateX(-${scrollDistance}px)` }
            : undefined
        }
      >
        {label}
      </span>
    </span>
  )
}

export function WorkspaceAcceleratorHeaderPicker({
  lessonGroupOptions,
  selectedLessonGroupKey,
  tutorialCallout,
  tutorialInteractionPolicy = null,
  viewerOpen = false,
  layout = "inline",
  onLessonGroupChange,
}: {
  lessonGroupOptions: WorkspaceAcceleratorLessonGroupSummary[]
  selectedLessonGroupKey: string
  tutorialCallout: WorkspaceAcceleratorTutorialCallout | null
  tutorialInteractionPolicy?: WorkspaceAcceleratorTutorialInteractionPolicy | null
  viewerOpen?: boolean
  layout?: "inline" | "rail" | "badge"
  onLessonGroupChange: (nextLessonGroupKey: string) => void
}) {
  const selectedLessonGroupIndex = lessonGroupOptions.findIndex(
    (option) => option.key === selectedLessonGroupKey
  )
  const selectedLessonGroup =
    selectedLessonGroupIndex >= 0
      ? lessonGroupOptions[selectedLessonGroupIndex]
      : null
  const ActiveLessonGroupIcon = useMemo(() => {
    if (!selectedLessonGroup) return Layers
    return getTrackIcon(selectedLessonGroup.label)
  }, [selectedLessonGroup])
  const selectedLessonGroupLabel = selectedLessonGroup?.label ?? "Classes"
  const progressSegment = resolveAcceleratorModuleProgressSegment({
    moduleSequenceIndex: selectedLessonGroupIndex + 1,
    moduleSequenceTotal: lessonGroupOptions.length,
  })
  const progressSegmentVisual =
    ACCELERATOR_PROGRESS_SEGMENT_VISUALS[progressSegment]
  const pickerHighlighted = tutorialCallout?.focus === "picker"
  const tutorialManagedPicker = Boolean(tutorialInteractionPolicy)
  const classDropdownLocked =
    shouldWorkspaceAcceleratorTutorialBlockClassDropdownOpen({
      tutorialInteractionPolicy,
    })
  const classSelectionGuard = useWorkspaceAcceleratorTutorialGuard({
    enabled: Boolean(tutorialInteractionPolicy),
    defaultMessage:
      tutorialInteractionPolicy?.blockedMessage ??
      "We'll go over this soon, I promise! :)",
    durationMs: tutorialInteractionPolicy?.blockedMessageDurationMs ?? 3000,
  })
  const calloutId = "workspace-accelerator-header-picker:class-selection"

  const triggerElement = (
    <WorkspaceAcceleratorTutorialGuardTooltip
      open={classSelectionGuard.open}
      message={classSelectionGuard.message}

      side="top"
      align="end"
      sideOffset={10}
    >
      <SelectTrigger

        className={cn(
          "border-border/65 bg-background/80 relative h-8 min-h-8 gap-1.5 overflow-visible px-2 text-left text-sm",
          layout === "badge"
            ? WORKSPACE_ACCELERATOR_BADGE_PICKER_TRIGGER_CLASSNAME
            : layout === "rail"
              ? WORKSPACE_ACCELERATOR_RAIL_PICKER_TRIGGER_CLASSNAME
              : viewerOpen
                ? WORKSPACE_ACCELERATOR_EXPANDED_PICKER_TRIGGER_CLASSNAME
                : WORKSPACE_ACCELERATOR_COMPACT_PICKER_TRIGGER_CLASSNAME,
          tutorialManagedPicker &&
            WORKSPACE_ACCELERATOR_TUTORIAL_PICKER_TRIGGER_CLASSNAME
        )}
        title={selectedLessonGroupLabel}
        aria-label={`Choose a class track. Current selection: ${selectedLessonGroupLabel}`}
        aria-disabled={classDropdownLocked ? "true" : undefined}
        data-tutorial-interaction-locked={
          classDropdownLocked ? "true" : undefined
        }
        data-slot={layout === "badge" ? "badge" : undefined}
        size={layout === "badge" ? "sm" : "default"}
      >
        {pickerHighlighted ? (
          <WorkspaceTutorialCallout
            calloutId={`${calloutId}:callout`}
            mode="indicator"
            tooltipContentClassName={
              WORKSPACE_TUTORIAL_INVERSE_TOOLTIP_CLASSNAME
            }
            indicatorAnchorAlign="end"
            indicatorAnchorVerticalAlign="center"
            indicatorSide="right"
            indicatorSideOffset={12}
          />
        ) : null}
        <span
          className="inline-flex size-4 shrink-0 items-center justify-center"
          data-progress-segment={progressSegment}
        >
          <ActiveLessonGroupIcon
            className={cn("h-3.5 w-3.5", progressSegmentVisual.iconClassName)}
            aria-hidden
          />
        </span>
        <WorkspaceAcceleratorHeaderPickerLabel
          label={selectedLessonGroupLabel}
        />
      </SelectTrigger>
    </WorkspaceAcceleratorTutorialGuardTooltip>
  )
  const trigger =
    layout === "badge" ? (
      <Badge
        asChild
        variant="outline"
        className={WORKSPACE_ACCELERATOR_BADGE_PICKER_TRIGGER_CLASSNAME}
      >
        {triggerElement}
      </Badge>
    ) : (
      triggerElement
    )

  return (
    <div

      className={cn(
        layout === "badge"
          ? "inline-flex min-w-0 max-w-[min(18rem,100%)] items-center [&_[data-slot=badge]]:max-w-full"
          : layout === "rail"
            ? "flex w-full items-start"
            : "inline-flex items-start pb-1"
      )}
    >
      <Select
        value={selectedLessonGroupKey}
        open={classDropdownLocked ? false : undefined}
        onOpenChange={(nextOpen) => {
          if (nextOpen && classDropdownLocked) {
            classSelectionGuard.showBlockedFeedback("class-selection")
          }
        }}
        onValueChange={(nextLessonGroupKey) => {
          if (
            shouldWorkspaceAcceleratorTutorialBlockClassSelection({
              tutorialInteractionPolicy,
              lessonGroupKey: nextLessonGroupKey,
            })
          ) {
            classSelectionGuard.showBlockedFeedback("class-selection")
            return
          }

          onLessonGroupChange(nextLessonGroupKey)
        }}
      >
        {trigger}
        <SelectContent
          align="end"
          className="border-border/70 bg-popover text-popover-foreground"

        >
          {lessonGroupOptions.map((option, optionIndex) => {
            const OptionIcon = getTrackIcon(option.label)
            const optionProgressSegment =
              resolveAcceleratorModuleProgressSegment({
                moduleSequenceIndex: optionIndex + 1,
                moduleSequenceTotal: lessonGroupOptions.length,
              })
            const optionProgressSegmentVisual =
              ACCELERATOR_PROGRESS_SEGMENT_VISUALS[optionProgressSegment]

            return (
              <SelectItem
                key={option.key}
                value={option.key}
                className={cn(
                  "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
                  tutorialInteractionPolicy &&
                    !isWorkspaceAcceleratorTutorialPinnedClassGroup({
                      tutorialInteractionPolicy,
                      lessonGroupKey: option.key,
                    }) &&
                    "opacity-80"
                )}
                icon={
                  <OptionIcon
                    className={cn(
                      "h-4 w-4",
                      optionProgressSegmentVisual.iconClassName
                    )}
                    data-progress-segment={optionProgressSegment}
                    aria-hidden
                  />
                }
              >
                {option.label}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
