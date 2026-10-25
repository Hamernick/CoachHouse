"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import CalendarPlusIcon from "lucide-react/dist/esm/icons/calendar-plus"
import PencilIcon from "lucide-react/dist/esm/icons/pencil"

import {
  createRoadmapCalendarEvent,
  deleteRoadmapCalendarEvent,
  updateRoadmapCalendarEvent,
} from "@/actions/roadmap-calendar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"
import type { RoadmapCalendarEventInput } from "@/lib/roadmap/calendar"
import { calendarParticleHref } from "@/lib/roadmap/calendar-particle-link"

import type { UpcomingEvent } from "../../_lib/types"
import {
  buildDefaultCalendarEventDraft,
  fromDatetimeLocal,
  type CalendarEventDraft,
} from "./workspace-board-calendar-event-sheet-helpers"
import {
  WorkspaceBoardCalendarEventSheetFooter,
  WorkspaceBoardCalendarEventSheetFormFields,
} from "./workspace-board-calendar-event-sheet-form"

export function WorkspaceBoardCalendarEventSheet({
  mode,
  canEdit,
  event,
  triggerLabel,
  triggerVariant = "outline",
  triggerClassName,
}: {
  mode: "create" | "edit"
  canEdit: boolean
  event?: UpcomingEvent | null
  triggerLabel: string
  triggerVariant?: "default" | "outline" | "ghost"
  triggerClassName?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<CalendarEventDraft>(() =>
    buildDefaultCalendarEventDraft(event)
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const canEditTarget = canEdit && (mode === "create" || Boolean(event?.id))

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) return
    setDraft(buildDefaultCalendarEventDraft(event))
    setFormError(null)
  }

  const handleSave = () => {
    if (!canEditTarget) return
    if (!draft.title.trim()) {
      setFormError("Event title is required.")
      return
    }
    if (!draft.startsAt) {
      setFormError("Start date is required.")
      return
    }

    const startsAtIso = fromDatetimeLocal(draft.startsAt)
    if (!startsAtIso) {
      setFormError("Start date is invalid.")
      return
    }

    const endsAtIso = draft.endsAt ? fromDatetimeLocal(draft.endsAt) : ""
    if (draft.endsAt && !endsAtIso) {
      setFormError("End date is invalid.")
      return
    }

    setFormError(null)
    startTransition(async () => {
      const payload: RoadmapCalendarEventInput = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        eventType: draft.eventType,
        startsAt: startsAtIso,
        endsAt: endsAtIso || null,
        allDay: draft.allDay,
        status: draft.status,
        assignedRoles: draft.assignedRoles,
        recurrence: draft.recurrence,
      }

      const result =
        mode === "edit" && event?.id
          ? await updateRoadmapCalendarEvent({
              calendarType: "internal",
              eventId: event.id,
              updates: {
                ...payload,
                expectedUpdatedAt: event.updated_at,
              },
            })
          : await createRoadmapCalendarEvent({
              calendarType: "internal",
              event: payload,
            })

      if ("error" in result) {
        setFormError(result.error)
        toast.error(result.error)
        return
      }

      toast.success(mode === "edit" ? "Event updated" : "Event created")
      setOpen(false)
      router.refresh()
    })
  }

  const handleDelete = () => {
    if (!canEditTarget || mode !== "edit" || !event?.id) return

    startTransition(async () => {
      const result = await deleteRoadmapCalendarEvent({
        calendarType: "internal",
        eventId: event.id,
      })

      if ("error" in result) {
        toast.error(result.error)
        return
      }

      toast.success("Event removed")
      setOpen(false)
      router.refresh()
    })
  }

  const particleTarget = event?.source?.particleId
  if (particleTarget && event)
    return (
      <Button type="button" variant={triggerVariant} size="sm"
        className={cn("h-9", triggerClassName)}
        aria-label={`Open ${event.title} on canvas`}
        onClick={() => router.push(calendarParticleHref(particleTarget), { scroll: false })}>
        Open Event
      </Button>
    )

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          size="sm"
          className={cn("h-9", triggerClassName)}
          disabled={!canEditTarget}
        >
          {mode === "create" ? (
            <CalendarPlusIcon className="h-4 w-4" aria-hidden />
          ) : (
            <PencilIcon className="h-4 w-4" aria-hidden />
          )}
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {mode === "edit" ? "Edit event" : "Add event"}
          </SheetTitle>
          <SheetDescription>
            Create and manage calendar events directly from the workspace board.
          </SheetDescription>
        </SheetHeader>

        <WorkspaceBoardCalendarEventSheetFormFields
          draft={draft}
          setDraft={setDraft}
          formError={formError}
        />

        <WorkspaceBoardCalendarEventSheetFooter
          mode={mode}
          canEditTarget={canEditTarget}
          isPending={isPending}
          onDelete={handleDelete}
          onCancel={() => setOpen(false)}
          onSave={handleSave}
        />
      </SheetContent>
    </Sheet>
  )
}
