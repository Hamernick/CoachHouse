"use client"

import { memo, useCallback, useState } from "react"
import MoreHorizontalIcon from "lucide-react/dist/esm/icons/more-horizontal"
import PencilIcon from "lucide-react/dist/esm/icons/pencil"
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import type { WorkspaceCustomPeopleSegment } from "./workspace-canvas-people-segment-types"

type WorkspacePeopleSegmentActionsProps = {
  segment: WorkspaceCustomPeopleSegment
  canManageSegments: boolean
  onEditSegment: (segmentId: string) => void
  onRemoveSegment: (segmentId: string) => void
}

export const WorkspacePeopleSegmentActions = memo(
  function WorkspacePeopleSegmentActions({
    segment,
    canManageSegments,
    onEditSegment,
    onRemoveSegment,
  }: WorkspacePeopleSegmentActionsProps) {
    const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
    const handleConfirmRemoveSegment = useCallback(() => {
      onRemoveSegment(segment.id)
      setConfirmRemoveOpen(false)
    }, [onRemoveSegment, segment.id])

    return (
      <>
        {canManageSegments ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="nodrag nopan text-muted-foreground hover:text-foreground size-6 shrink-0 rounded-lg"
                aria-label={`Manage ${segment.label}`}
                title="Segment options"
              >
                <MoreHorizontalIcon aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 p-1">
              <PopoverClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="nodrag nopan h-8 w-full justify-start gap-2 rounded-sm px-2 text-sm font-normal"
                  onClick={() => onEditSegment(segment.id)}
                >
                  <PencilIcon aria-hidden />
                  Rename
                </Button>
              </PopoverClose>
              <PopoverClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="nodrag nopan text-destructive hover:text-destructive h-8 w-full justify-start gap-2 rounded-sm px-2 text-sm font-normal"
                  onClick={() => setConfirmRemoveOpen(true)}
                >
                  <Trash2Icon aria-hidden />
                  Delete segment
                </Button>
              </PopoverClose>
            </PopoverContent>
          </Popover>
        ) : null}
        {canManageSegments ? (
          <AlertDialog
            open={confirmRemoveOpen}
            onOpenChange={setConfirmRemoveOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {segment.label}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes the custom segment only. People in the segment
                  stay in the drawer and on the canvas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleConfirmRemoveSegment}
                >
                  Delete segment
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </>
    )
  }
)
