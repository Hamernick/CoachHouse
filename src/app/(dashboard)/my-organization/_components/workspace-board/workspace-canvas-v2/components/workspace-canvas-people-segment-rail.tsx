"use client"

import { memo, type DragEvent } from "react"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import XIcon from "lucide-react/dist/esm/icons/x"

import { Button } from "@/components/ui/button"
import {
  Editable,
  EditableArea,
  EditableCancel,
  EditableInput,
  EditableSubmit,
  EditableToolbar,
} from "@/components/ui/editable"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { useScrollFadeEffect } from "@/lib/scroll-fade-effect"

import { WorkspacePeopleSegmentActions } from "./workspace-canvas-people-segment-content-header"
import type { WorkspacePeopleSegment } from "./workspace-canvas-people-segment-types"

type WorkspacePeopleSegmentRailProps = {
  segments: WorkspacePeopleSegment[]
  selectedSegmentId: string
  editingSegmentId: string | null
  draggingPersonCount: number
  activeDropSegmentId: string | null
  canManageSegments: boolean
  onSegmentChange: (segmentId: string) => void
  onRenameSegment: (segmentId: string, label: string) => void
  onEditSegment: (segmentId: string) => void
  onRemoveSegment: (segmentId: string) => void
  onCancelEditSegment: () => void
  onSegmentDragOver: (
    segment: WorkspacePeopleSegment,
    event: DragEvent<HTMLElement>
  ) => void
  onSegmentDragEnter: (
    segment: WorkspacePeopleSegment,
    event: DragEvent<HTMLElement>
  ) => void
  onSegmentDragLeave: (segmentId: string, event: DragEvent<HTMLElement>) => void
  onPersonDrop: (segmentId: string, event: DragEvent<HTMLElement>) => void
}

const WorkspacePeopleCustomSegmentEditor = memo(
  function WorkspacePeopleCustomSegmentEditor({
    segment,
    onRenameSegment,
    onCancelEditSegment,
  }: {
    segment: Extract<WorkspacePeopleSegment, { kind: "custom" }>
    onRenameSegment: (segmentId: string, label: string) => void
    onCancelEditSegment: () => void
  }) {
    return (
      <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:slide-in-from-right-1 bg-background inline-flex h-6 shrink-0 items-center gap-1 rounded-lg pr-1 pl-2 shadow-none motion-safe:duration-150">
        <Editable
          key={segment.id}
          defaultValue={segment.label}
          defaultEditing
          autosize
          maxLength={32}
          placeholder="Segment name"
          onSubmit={(value) => onRenameSegment(segment.id, value)}
          onCancel={onCancelEditSegment}
          className="min-w-0 flex-row items-center gap-1"
        >
          <EditableArea className="min-w-0">
            <EditableInput
              aria-label={`Rename ${segment.label}`}
              className="border-border/70 h-5 max-w-40 min-w-24 rounded-md px-2 py-0 text-xs shadow-none"
            />
          </EditableArea>
          <EditableToolbar className="gap-0.5">
            <EditableSubmit asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="nodrag nopan text-muted-foreground hover:text-foreground size-5 rounded-md"
                aria-label={`Save ${segment.label}`}
                title="Save segment name"
              >
                <CheckIcon aria-hidden />
              </Button>
            </EditableSubmit>
            <EditableCancel asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="nodrag nopan text-muted-foreground hover:text-foreground size-5 rounded-md"
                aria-label={`Cancel editing ${segment.label}`}
                title="Cancel rename"
              >
                <XIcon aria-hidden />
              </Button>
            </EditableCancel>
          </EditableToolbar>
        </Editable>
        <span className="text-muted-foreground pr-1 text-[10px]">
          {segment.count}
        </span>
      </div>
    )
  }
)

const WorkspacePeopleSegmentTab = memo(function WorkspacePeopleSegmentTab({
  segment,
  selectedSegmentId,
  draggingPersonCount,
  activeDropSegmentId,
  canManageSegments,
  onEditSegment,
  onRemoveSegment,
  onSegmentDragOver,
  onSegmentDragEnter,
  onSegmentDragLeave,
  onPersonDrop,
}: {
  segment: WorkspacePeopleSegment
  selectedSegmentId: string
  draggingPersonCount: number
  activeDropSegmentId: string | null
  canManageSegments: boolean
  onEditSegment: (segmentId: string) => void
  onRemoveSegment: (segmentId: string) => void
  onSegmentDragOver: (
    segment: WorkspacePeopleSegment,
    event: DragEvent<HTMLElement>
  ) => void
  onSegmentDragEnter: (
    segment: WorkspacePeopleSegment,
    event: DragEvent<HTMLElement>
  ) => void
  onSegmentDragLeave: (segmentId: string, event: DragEvent<HTMLElement>) => void
  onPersonDrop: (segmentId: string, event: DragEvent<HTMLElement>) => void
}) {
  const custom = segment.kind === "custom"
  const selectedCustomSegment = custom && selectedSegmentId === segment.id
  const acceptingDrop = custom && draggingPersonCount > 0
  const activeDrop = acceptingDrop && activeDropSegmentId === segment.id

  return (
    <div
      data-workspace-people-segment-tab={segment.kind}
      data-workspace-people-segment-drop-target={
        activeDrop ? "true" : undefined
      }
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-lg",
        custom &&
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:slide-in-from-right-1 motion-safe:duration-150",
        acceptingDrop && "ring-border bg-background/60 ring-1 ring-inset",
        activeDrop && "ring-ring bg-accent ring-2",
        selectedCustomSegment && "bg-background shadow-none"
      )}
      title={
        acceptingDrop
          ? `Drop ${draggingPersonCount === 1 ? "person" : `${draggingPersonCount} people`} into ${segment.label}`
          : undefined
      }
      onDragOver={(event) => onSegmentDragOver(segment, event)}
      onDragEnter={(event) => onSegmentDragEnter(segment, event)}
      onDragLeave={(event) => onSegmentDragLeave(segment.id, event)}
      onDrop={(event) => {
        if (custom) onPersonDrop(segment.id, event)
      }}
    >
      <ToggleGroupItem
        value={segment.id}
        size="sm"
        className={cn(
          "data-[state=on]:bg-background h-6 rounded-lg border-0 px-3 text-xs data-[state=on]:shadow-none",
          selectedCustomSegment &&
            "pr-1 data-[state=on]:bg-transparent data-[state=on]:shadow-none",
          activeDrop &&
            "bg-accent text-accent-foreground data-[state=on]:bg-accent"
        )}
      >
        <span className="max-w-32 truncate">{segment.label}</span>
        <span className="text-muted-foreground ml-1 text-[10px]">
          {segment.count}
        </span>
      </ToggleGroupItem>
      {selectedCustomSegment && canManageSegments ? (
        <WorkspacePeopleSegmentActions
          segment={segment}
          canManageSegments={canManageSegments}
          onEditSegment={onEditSegment}
          onRemoveSegment={onRemoveSegment}
        />
      ) : null}
    </div>
  )
})

export const WorkspacePeopleSegmentRail = memo(
  function WorkspacePeopleSegmentRail({
    segments,
    selectedSegmentId,
    editingSegmentId,
    draggingPersonCount,
    activeDropSegmentId,
    canManageSegments,
    onSegmentChange,
    onRenameSegment,
    onEditSegment,
    onRemoveSegment,
    onCancelEditSegment,
    onSegmentDragOver,
    onSegmentDragEnter,
    onSegmentDragLeave,
    onPersonDrop,
  }: WorkspacePeopleSegmentRailProps) {
    const scrollFadeRef = useScrollFadeEffect(true, "horizontal")

    return (
      <div
        ref={scrollFadeRef}
        className="scroll-fade-effect-x min-w-0 flex-1 overflow-x-auto overscroll-x-contain [--mask-width:1.5rem] [scroll-padding-inline:1.5rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ToggleGroup
          type="single"
          spacing={1}
          value={selectedSegmentId}
          onValueChange={(value) => {
            if (value) onSegmentChange(value)
          }}
          className="bg-muted/70 h-8 w-max min-w-full rounded-xl p-1 shadow-none"
        >
          {segments.map((segment) =>
            segment.kind === "custom" && editingSegmentId === segment.id ? (
              <WorkspacePeopleCustomSegmentEditor
                key={segment.id}
                segment={segment}
                onRenameSegment={onRenameSegment}
                onCancelEditSegment={onCancelEditSegment}
              />
            ) : (
              <WorkspacePeopleSegmentTab
                key={segment.id}
                segment={segment}
                selectedSegmentId={selectedSegmentId}
                draggingPersonCount={draggingPersonCount}
                activeDropSegmentId={activeDropSegmentId}
                canManageSegments={canManageSegments}
                onEditSegment={onEditSegment}
                onRemoveSegment={onRemoveSegment}
                onSegmentDragOver={onSegmentDragOver}
                onSegmentDragEnter={onSegmentDragEnter}
                onSegmentDragLeave={onSegmentDragLeave}
                onPersonDrop={onPersonDrop}
              />
            )
          )}
        </ToggleGroup>
      </div>
    )
  }
)
