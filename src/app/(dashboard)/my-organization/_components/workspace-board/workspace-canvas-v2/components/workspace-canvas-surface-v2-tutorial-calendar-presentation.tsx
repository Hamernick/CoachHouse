"use client"

import { useMemo, useState } from "react"

import { RoadmapCalendarMonthAgendaPanel } from "@/components/roadmap/roadmap-calendar/components"
import { ROADMAP_CALENDAR_EVENT_TYPE_ORDER } from "@/components/roadmap/roadmap-calendar/components/roadmap-calendar-event-style"
import {
  getRoadmapCalendarEventDates,
  roadmapCalendarEventOccursOnDay,
  sortRoadmapCalendarEventsByStart,
} from "@/components/roadmap/roadmap-calendar/helpers"

import {
  formatCalendarDate,
  formatCalendarDateRange,
  type RoadmapCalendarEvent,
  type RoadmapCalendarEventType,
} from "@/lib/roadmap/calendar"

import { WORKSPACE_TUTORIAL_CALENDAR_POPOVER_WIDTH } from "./workspace-canvas-surface-v2-tutorial-presentation-state"

const WORKSPACE_TUTORIAL_CALENDAR_INITIAL_MONTH = new Date(2026, 5, 1)
const WORKSPACE_TUTORIAL_CALENDAR_SELECTED_DAY = 12

type WorkspaceTutorialCalendarEventSeed = {
  id: string
  day: number
  title: string
  eventType: RoadmapCalendarEventType
  hour: number
  durationMinutes?: number
  allDay?: boolean
  assignedRoles: RoadmapCalendarEvent["assignedRoles"]
}

const WORKSPACE_TUTORIAL_CALENDAR_EVENT_SEEDS: WorkspaceTutorialCalendarEventSeed[] = [
  {
    id: "grant-writing-sprint",
    day: 3,
    title: "Grant writing sprint",
    eventType: "deadline",
    hour: 9,
    allDay: true,
    assignedRoles: ["staff"],
  },
  {
    id: "finance-check-in",
    day: 5,
    title: "Finance check-in",
    eventType: "meeting",
    hour: 10,
    assignedRoles: ["admin"],
  },
  {
    id: "strategy-review",
    day: 6,
    title: "Strategy review",
    eventType: "meeting",
    hour: 10,
    assignedRoles: ["admin", "staff"],
  },
  {
    id: "volunteer-onboarding",
    day: 8,
    title: "Volunteer onboarding",
    eventType: "other",
    hour: 13,
    assignedRoles: ["staff"],
  },
  {
    id: "program-partner-call",
    day: 10,
    title: "Program partner call",
    eventType: "meeting",
    hour: 11,
    assignedRoles: ["staff"],
  },
  {
    id: "board-packet",
    day: WORKSPACE_TUTORIAL_CALENDAR_SELECTED_DAY,
    title: "Board packet deadline",
    eventType: "deadline",
    hour: 9,
    allDay: true,
    assignedRoles: ["admin"],
  },
  {
    id: "campaign-launch-review",
    day: WORKSPACE_TUTORIAL_CALENDAR_SELECTED_DAY,
    title: "Campaign launch review",
    eventType: "milestone",
    hour: 11,
    assignedRoles: ["admin", "staff"],
  },
  {
    id: "staff-prep-huddle",
    day: WORKSPACE_TUTORIAL_CALENDAR_SELECTED_DAY,
    title: "Staff prep huddle",
    eventType: "meeting",
    hour: 13,
    assignedRoles: ["staff"],
  },
  {
    id: "board-meeting",
    day: WORKSPACE_TUTORIAL_CALENDAR_SELECTED_DAY,
    title: "Board meeting",
    eventType: "board_meeting",
    hour: 15,
    durationMinutes: 90,
    assignedRoles: ["admin", "board"],
  },
  {
    id: "donor-stewardship-block",
    day: 14,
    title: "Donor stewardship block",
    eventType: "other",
    hour: 9,
    assignedRoles: ["admin", "staff"],
  },
  {
    id: "budget-approval-checkpoint",
    day: 16,
    title: "Budget approval checkpoint",
    eventType: "deadline",
    hour: 9,
    allDay: true,
    assignedRoles: ["admin", "board"],
  },
  {
    id: "program-launch",
    day: 18,
    title: "Program launch milestone",
    eventType: "milestone",
    hour: 9,
    allDay: true,
    assignedRoles: ["staff"],
  },
  {
    id: "community-demo-day",
    day: 20,
    title: "Community demo day",
    eventType: "milestone",
    hour: 10,
    assignedRoles: ["staff"],
  },
  {
    id: "operations-retrospective",
    day: 22,
    title: "Operations retrospective",
    eventType: "meeting",
    hour: 14,
    assignedRoles: ["admin", "staff"],
  },
  {
    id: "fundraising-review",
    day: 24,
    title: "Fundraising pipeline review",
    eventType: "meeting",
    hour: 11,
    assignedRoles: ["admin", "staff"],
  },
  {
    id: "quarterly-board-prep",
    day: 27,
    title: "Quarterly board prep",
    eventType: "board_meeting",
    hour: 10,
    durationMinutes: 90,
    assignedRoles: ["admin", "board"],
  },
  {
    id: "impact-report-due",
    day: 29,
    title: "Impact report due",
    eventType: "deadline",
    hour: 9,
    allDay: true,
    assignedRoles: ["admin"],
  },
]

function createWorkspaceTutorialCalendarDate({
  month,
  day,
  hour = 9,
  minute = 0,
}: {
  month: Date
  day: number
  hour?: number
  minute?: number
}) {
  return new Date(
    month.getFullYear(),
    month.getMonth(),
    day,
    hour,
    minute,
    0,
    0,
  )
}

function createWorkspaceTutorialCalendarEvent({
  month,
  id,
  day,
  title,
  eventType,
  hour,
  durationMinutes = 60,
  allDay = false,
  assignedRoles,
}: WorkspaceTutorialCalendarEventSeed & {
  month: Date
}): RoadmapCalendarEvent {
  const startsAt = createWorkspaceTutorialCalendarDate({
    month,
    day,
    hour,
  })
  const endsAt = allDay
    ? null
    : new Date(startsAt.getTime() + durationMinutes * 60_000)
  const timestamp = createWorkspaceTutorialCalendarDate({
    month,
    day: 1,
  }).toISOString()

  return {
    id: `tutorial-calendar-${id}`,
    orgId: "workspace-tutorial",
    title,
    description: null,
    eventType,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt?.toISOString() ?? null,
    allDay,
    recurrence: null,
    status: "active",
    assignedRoles,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function buildWorkspaceTutorialCalendarEvents(month: Date) {
  return WORKSPACE_TUTORIAL_CALENDAR_EVENT_SEEDS.map((seed) =>
    createWorkspaceTutorialCalendarEvent({
      month,
      ...seed,
    }),
  )
}

function buildWorkspaceTutorialCalendarEventDatesByType(
  events: RoadmapCalendarEvent[],
) {
  const initial = ROADMAP_CALENDAR_EVENT_TYPE_ORDER.reduce(
    (acc, eventType) => {
      acc[eventType] = []
      return acc
    },
    {} as Record<RoadmapCalendarEventType, Date[]>,
  )

  for (const event of events) {
    initial[event.eventType].push(...getRoadmapCalendarEventDates(event))
  }

  return initial
}

export function WorkspaceTutorialCalendarPresentation() {
  const [month, setMonth] = useState(WORKSPACE_TUTORIAL_CALENDAR_INITIAL_MONTH)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() =>
    createWorkspaceTutorialCalendarDate({
      month: WORKSPACE_TUTORIAL_CALENDAR_INITIAL_MONTH,
      day: WORKSPACE_TUTORIAL_CALENDAR_SELECTED_DAY,
    }),
  )
  const events = useMemo(
    () => buildWorkspaceTutorialCalendarEvents(month),
    [month],
  )
  const dayEvents = useMemo(() => {
    if (!selectedDate) return []
    return events
      .filter((event) => roadmapCalendarEventOccursOnDay(event, selectedDate))
      .sort(sortRoadmapCalendarEventsByStart)
  }, [events, selectedDate])
  const eventDatesByType = useMemo(
    () => buildWorkspaceTutorialCalendarEventDatesByType(events),
    [events],
  )
  const handleMonthChange = (date: Date) => {
    const nextMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    setMonth(nextMonth)
    setSelectedDate(
      createWorkspaceTutorialCalendarDate({
        month: nextMonth,
        day: WORKSPACE_TUTORIAL_CALENDAR_SELECTED_DAY,
      }),
    )
  }

  return (
    <div
      className="mx-auto flex w-full justify-center"
      style={{ width: WORKSPACE_TUTORIAL_CALENDAR_POPOVER_WIDTH }}
    >
      <div
        className="bg-background/95 w-[22rem] overflow-hidden rounded-[24px] border-0 p-0 shadow-none backdrop-blur-xl"

      >
        <RoadmapCalendarMonthAgendaPanel
          month={month}
          selectedDate={selectedDate}
          events={events}
          dayEvents={dayEvents}
          isLoading={false}
          canManageCalendar={false}
          eventDatesByType={eventDatesByType}
          onMonthChange={handleMonthChange}
          onSelectDate={setSelectedDate}
          onGoToToday={() => handleMonthChange(new Date())}
          onOpenCreate={() => {}}
          onEditEvent={() => {}}
          formatDate={formatCalendarDate}
          formatTimeRange={formatCalendarDateRange}
          className="rounded-[24px]"
        />
      </div>
    </div>
  )
}
