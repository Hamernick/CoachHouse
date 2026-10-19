import { memo, type Dispatch, type SetStateAction } from "react"
import RepeatIcon from "lucide-react/dist/esm/icons/repeat"
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  formatCalendarRecurrence,
  getRoadmapCalendarEventTypeLabel,
  ROADMAP_CALENDAR_EVENT_TYPES,
  type RoadmapCalendarEvent,
  type RoadmapCalendarRecurrence,
} from "@/lib/roadmap/calendar"

import { ROLE_OPTIONS } from "../constants"
import type { EventDraft } from "../types"
import { ROADMAP_CALENDAR_EVENT_TYPE_META } from "./roadmap-calendar-event-style"

type RoadmapCalendarEventDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingEvent: RoadmapCalendarEvent | null
  draft: EventDraft
  setDraft: Dispatch<SetStateAction<EventDraft>>
  isPending: boolean
  onDelete: () => void
  onSave: () => void
}

export const RoadmapCalendarEventDrawer = memo(function RoadmapCalendarEventDrawer({
  open,
  onOpenChange,
  editingEvent,
  draft,
  setDraft,
  isPending,
  onDelete,
  onSave,
}: RoadmapCalendarEventDrawerProps) {
  const eventTypeMeta = ROADMAP_CALENDAR_EVENT_TYPE_META[draft.eventType]

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="sm:max-w-lg">
        <DrawerHeader>
          <DrawerTitle>{editingEvent ? "Edit event" : "New event"}</DrawerTitle>
          <DrawerDescription className="sr-only">
            Create or update an internal roadmap calendar event.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="calendar-title">Title</Label>
            <Input
              id="calendar-title"
              value={draft.title}
              onChange={(event) => {
                const value = event.currentTarget.value
                setDraft((prev) => ({ ...prev, title: value }))
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="calendar-description">Details</Label>
            <Textarea
              id="calendar-description"
              value={draft.description}
              onChange={(event) => {
                const value = event.currentTarget.value
                setDraft((prev) => ({ ...prev, description: value }))
              }}
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label>Type</Label>
            <Select
              value={draft.eventType}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, eventType: value as EventDraft["eventType"] }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ROADMAP_CALENDAR_EVENT_TYPES.map((eventType) => (
                    <SelectItem
                      key={eventType}
                      value={eventType}
                      icon={
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            ROADMAP_CALENDAR_EVENT_TYPE_META[eventType].dotClassName,
                          )}
                          aria-hidden
                        />
                      }
                    >
                      {getRoadmapCalendarEventTypeLabel(eventType)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Badge
              variant="secondary"
              className={cn("w-fit rounded-full border-0 px-2 py-0.5 text-xs", eventTypeMeta.badgeClassName)}
            >
              <span className={cn("size-2 rounded-full", eventTypeMeta.dotClassName)} aria-hidden />
              {getRoadmapCalendarEventTypeLabel(draft.eventType)}
            </Badge>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="calendar-start">Start</Label>
            <Input
              id="calendar-start"
              type="datetime-local"
              value={draft.startsAt}
              onChange={(event) => {
                const value = event.currentTarget.value
                setDraft((prev) => ({ ...prev, startsAt: value }))
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="calendar-end">End</Label>
            <Input
              id="calendar-end"
              type="datetime-local"
              value={draft.endsAt}
              onChange={(event) => {
                const value = event.currentTarget.value
                setDraft((prev) => ({ ...prev, endsAt: value }))
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="calendar-all-day"
              checked={draft.allDay}
              onCheckedChange={(checked) =>
                setDraft((prev) => ({ ...prev, allDay: Boolean(checked) }))
              }
            />
            <Label htmlFor="calendar-all-day">All day</Label>
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={draft.status}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, status: value as EventDraft["status"] }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Assign to</Label>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((role) => (
                <Button
                  key={role.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-auto rounded-full px-3 py-1 text-xs font-medium",
                    draft.assignedRoles.includes(role.id)
                      ? "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background"
                      : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/50",
                  )}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      assignedRoles: prev.assignedRoles.includes(role.id)
                        ? prev.assignedRoles.filter((item) => item !== role.id)
                        : [...prev.assignedRoles, role.id],
                    }))
                  }
                >
                  {role.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">Repeat</p>
                <p className="text-xs text-muted-foreground">
                  {draft.recurrence
                    ? formatCalendarRecurrence(draft.recurrence)
                    : "No recurrence"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    recurrence: prev.recurrence ?? { frequency: "monthly" },
                  }))
                }
              >
                <RepeatIcon data-icon="inline-start" aria-hidden />
                Set
              </Button>
            </div>
            {draft.recurrence ? (
              <div className="mt-3 grid gap-2">
                <Label>Frequency</Label>
                <Select
                  value={draft.recurrence.frequency}
                  onValueChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      recurrence: {
                        ...(prev.recurrence ?? { frequency: "monthly" }),
                        frequency: value as RoadmapCalendarRecurrence["frequency"],
                      },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <div className="grid gap-2">
                  <Label htmlFor="calendar-recurrence-end">Ends on (optional)</Label>
                  <Input
                    id="calendar-recurrence-end"
                    type="date"
                    value={draft.recurrence.endDate ?? ""}
                    onChange={(event) => {
                      const value = event.currentTarget.value
                      setDraft((prev) => ({
                        ...prev,
                        recurrence: prev.recurrence
                          ? { ...prev.recurrence, endDate: value || null }
                          : null,
                      }))
                    }}
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start text-xs text-muted-foreground"
                  onClick={() => setDraft((prev) => ({ ...prev, recurrence: null }))}
                >
                  Clear recurrence
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        <DrawerFooter className="border-t border-border/60 bg-background/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {editingEvent ? (
              <Button
                type="button"
                variant="ghost"
                className="gap-2 text-destructive"
                onClick={onDelete}
              >
                <Trash2Icon data-icon="inline-start" aria-hidden />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={onSave} disabled={isPending}>
                {editingEvent ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
})
