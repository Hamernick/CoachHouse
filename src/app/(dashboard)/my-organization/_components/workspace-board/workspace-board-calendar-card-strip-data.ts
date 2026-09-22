import type { UpcomingEvent } from "../../_lib/types"
import { workspaceCalendarEventAccentClassName } from "@/components/workspace/workspace-calendar-date-strip-preview"
import { safeDateLabel } from "../../_lib/helpers"
import type { MyOrganizationCalendarView } from "../../_lib/types"

export type CalendarStripEventItem = {
  id: string
  title: string
  timeLabel: string
  invitesLabel: string | null
  accentClassName: string
  event: UpcomingEvent | null
  detailDescription: string | null
  isPreview: boolean
}

export type CalendarStripObjectiveItem = {
  id: string
  title: string
  status: "active" | "todo" | "done"
}

export function resolveVisibleCalendarEvents({
  upcomingEvents,
  selectedDayEvents,
  requestedEventId,
  limit = 3,
}: {
  upcomingEvents: MyOrganizationCalendarView["upcomingEvents"]
  selectedDayEvents: MyOrganizationCalendarView["upcomingEvents"]
  requestedEventId?: string | null
  limit?: number
}) {
  const baseEvents =
    selectedDayEvents.length > 0
      ? selectedDayEvents.slice(0, limit)
      : upcomingEvents.slice(0, limit)
  const requestedEvent = requestedEventId
    ? selectedDayEvents.find((event) => event.id === requestedEventId)
    : null

  return requestedEvent
    ? [
        requestedEvent,
        ...baseEvents.filter((event) => event.id !== requestedEvent.id),
      ].slice(0, limit)
    : baseEvents
}

export function buildCalendarStripEventPreview({
  visibleEvents,
  selectedDayEvents,
}: {
  visibleEvents: MyOrganizationCalendarView["upcomingEvents"]
  selectedDayEvents: MyOrganizationCalendarView["upcomingEvents"]
}) {
  const shouldShowPreviewData =
    visibleEvents.length === 0 && selectedDayEvents.length === 0

  const eventItems: CalendarStripEventItem[] = !shouldShowPreviewData
    ? visibleEvents.map((event) => ({
        id: event.id,
        title: event.title,
        timeLabel: event.all_day
          ? safeDateLabel(event.starts_at)
          : safeDateLabel(event.starts_at, true),
        invitesLabel: event.assigned_roles.length
          ? `Invites: ${event.assigned_roles.join(", ")}`
          : null,
        accentClassName: workspaceCalendarEventAccentClassName(
          event.assigned_roles
        ),
        event,
        detailDescription: event.description,
        isPreview: false,
      }))
    : [
        {
          id: "preview-event-1",
          title: "Board check-in",
          timeLabel: "Today · 10:00 AM",
          invitesLabel: "Invites: Board",
          accentClassName: "before:bg-emerald-500",
          event: null,
          detailDescription:
            "A recurring board check-in keeps decisions, accountability, and leadership rhythm visible on the calendar.",
          isPreview: true,
        },
        {
          id: "preview-event-2",
          title: "Program cohort launch sync",
          timeLabel: "Today · 2:30 PM",
          invitesLabel: "Invites: Program team",
          accentClassName: "before:bg-sky-500",
          event: null,
          detailDescription:
            "Program launch syncs help staff align around deadlines, responsibilities, and launch readiness before milestones slip.",
          isPreview: true,
        },
      ]

  return {
    eventItems,
    selectedDayEventCount: shouldShowPreviewData
      ? eventItems.length
      : selectedDayEvents.length,
  }
}

export const CALENDAR_STRIP_OBJECTIVE_PREVIEW_ITEMS: CalendarStripObjectiveItem[] =
  [
    { id: "objective-1", title: "Finalize board packet", status: "active" },
    { id: "objective-2", title: "Confirm guest speaker", status: "todo" },
    { id: "objective-3", title: "Publish monthly update", status: "done" },
  ]
