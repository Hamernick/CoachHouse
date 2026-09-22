"use client"

import { memo, type ReactNode } from "react"
import ChevronLeftIcon from "lucide-react/dist/esm/icons/chevron-left"
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right"
import CircleIcon from "lucide-react/dist/esm/icons/circle"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { Separator } from "@/components/ui/separator"
import {
  type RoadmapCalendarEvent,
  type RoadmapCalendarEventInput,
  type RoadmapCalendarEventType,
} from "@/lib/roadmap/calendar"
import {
  PersonalCalendarAgenda,
  calendarEventOccursOnDay,
  type CalendarEvent,
} from "@/features/google-calendar/client"

import { cn } from "@/lib/utils"

import { RoadmapCalendarMonthGrid } from "./roadmap-calendar-month-grid"
import {
  ROADMAP_CALENDAR_EVENT_MODIFIER_BY_TYPE,
  ROADMAP_CALENDAR_EVENT_TYPE_ORDER,
} from "./roadmap-calendar-event-style"
import {
  addMonths,
  formatAgendaHeading,
  formatMonthLabel,
  isSameCalendarMonth,
  RoadmapCalendarAddEventMenu,
  RoadmapCalendarAgendaRow,
  RoadmapCalendarAgendaScroll,
} from "./roadmap-calendar-month-agenda-panel-parts"

type RoadmapCalendarMonthAgendaPanelProps = {
  monthGridOnly?: boolean
  personalEvents?: CalendarEvent[]
  googleCalendarControls?: ReactNode
  compactHeaderControls?: boolean
  month: Date
  selectedDate: Date | undefined
  events: RoadmapCalendarEvent[]
  dayEvents: RoadmapCalendarEvent[]
  isLoading: boolean
  canManageCalendar: boolean
  eventDatesByType: Record<RoadmapCalendarEventType, Date[]>
  onMonthChange: (date: Date) => void
  onSelectDate: (date: Date | undefined) => void
  onGoToToday: () => void
  onOpenCreate: (preset?: {
    title?: string
    eventType?: RoadmapCalendarEventInput["eventType"]
  }) => void
  onEditEvent: (event: RoadmapCalendarEvent) => void
  formatDate: (value: string, options?: Intl.DateTimeFormatOptions) => string
  formatTimeRange: (event: RoadmapCalendarEvent) => string
  className?: string
}

const ROADMAP_CALENDAR_MONTH_AGENDA_PANEL_SOURCE =
  "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel.tsx"

export const RoadmapCalendarMonthAgendaPanel = memo(
  function RoadmapCalendarMonthAgendaPanel({
    monthGridOnly = false,
    compactHeaderControls = false,
    personalEvents = [],
    googleCalendarControls,
    month,
    selectedDate,
    events,
    dayEvents,
    isLoading,
    canManageCalendar,
    eventDatesByType,
    onMonthChange,
    onSelectDate,
    onGoToToday,
    onOpenCreate,
    onEditEvent,
    formatDate,
    formatTimeRange,
    className,
  }: RoadmapCalendarMonthAgendaPanelProps) {
    const eventModifiers = ROADMAP_CALENDAR_EVENT_TYPE_ORDER.reduce(
      (acc, eventType) => {
        acc[ROADMAP_CALENDAR_EVENT_MODIFIER_BY_TYPE[eventType]] =
          eventDatesByType[eventType]
        return acc
      },
      {} as Record<string, Date[]>
    )
    const personalDayEvents = selectedDate
      ? personalEvents.filter((event) =>
          calendarEventOccursOnDay(event, selectedDate)
        )
      : []
    const totalDayEvents = dayEvents.length + personalDayEvents.length
    const showTodayButton = !isSameCalendarMonth(month, new Date())

    return (
      <section
        className={
          monthGridOnly
            ? "contents"
            : cn(
                "border-border/60 bg-muted/45 mx-auto flex max-h-[min(42rem,calc(100svh-5.5rem))] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border p-2.5",
                className
              )
        }
      >
        {!monthGridOnly ? (
          <div className="grid grid-cols-1 items-center gap-2 px-2 pt-1 pb-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-foreground shrink-0 text-lg font-semibold tracking-normal whitespace-nowrap">
                {formatMonthLabel(month)}
              </h2>
              <Badge
                variant="secondary"
                className="bg-muted-foreground/10 text-muted-foreground h-6 min-w-8 rounded-full border-0 px-2 text-xs tabular-nums"
              >
                {events.length + personalEvents.length}
              </Badge>
            </div>
            <div className="flex min-w-0 shrink-0 items-center gap-1.5 justify-self-end">
              <RoadmapCalendarAddEventMenu
                disabled={!canManageCalendar}
                iconOnly={compactHeaderControls}
                onOpenCreate={onOpenCreate}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 rounded-full shadow-none"
                onClick={() => onMonthChange(addMonths(month, -1))}
                aria-label="Show previous month"
              >
                <ChevronLeftIcon data-icon aria-hidden />
              </Button>
              {showTodayButton ? (
                <Button
                  type="button"
                  variant="outline"
                  size={compactHeaderControls ? "icon" : "default"}
                  className={cn(
                    "h-8 rounded-full shadow-none",
                    compactHeaderControls ? "w-8" : "px-3 text-sm"
                  )}
                  onClick={onGoToToday}
                  aria-label={compactHeaderControls ? "Go to today" : undefined}
                  title={compactHeaderControls ? "Go to today" : undefined}
                >
                  {compactHeaderControls ? (
                    <CircleIcon className="size-2 fill-current" aria-hidden />
                  ) : (
                    "Today"
                  )}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 rounded-full shadow-none"
                onClick={() => onMonthChange(addMonths(month, 1))}
                aria-label="Show next month"
              >
                <ChevronRightIcon data-icon aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}

        <div
          className="bg-background flex min-h-0 w-full flex-col rounded-[24px] px-3 py-3"
          {...getReactGrabOwnerProps({
            ownerId: "roadmap-calendar-month-agenda:month-grid",
            component: "RoadmapCalendarMonthAgendaPanel",
            source:
              "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel.tsx",
            slot: "month-grid",
            primitiveImport: "@/components/ui/calendar",
          })}
        >
          <RoadmapCalendarMonthGrid
            selectedDate={selectedDate}
            month={month}
            onMonthChange={onMonthChange}
            onSelectDate={onSelectDate}
            modifiers={{
              ...eventModifiers,
              google_calendar: (date) =>
                personalEvents.some((event) =>
                  calendarEventOccursOnDay(event, date)
                ),
            }}
          />

          {googleCalendarControls}

          <Separator className="bg-border/40 mt-3" />

          <div className="flex min-h-0 flex-col pt-3">
            <p className="text-muted-foreground/70 text-xs font-semibold tracking-[0.2em] uppercase">
              {formatAgendaHeading({
                selectedDate,
                eventCount: totalDayEvents,
              })}
            </p>
            <RoadmapCalendarAgendaScroll
              fadeEligible={totalDayEvents > 1 && !isLoading}
            >
              {isLoading ? (
                <p className="text-muted-foreground px-2 py-3 text-sm">
                  Loading…
                </p>
              ) : totalDayEvents > 0 ? (
                <>
                  {dayEvents.map((event) => (
                    <RoadmapCalendarAgendaRow
                      key={event.id}
                      event={event}
                      canManageCalendar={canManageCalendar}
                      formatTimeRange={formatTimeRange}
                      onEditEvent={onEditEvent}
                    />
                  ))}
                  <PersonalCalendarAgenda events={personalDayEvents} />
                </>
              ) : (
                <p className="text-muted-foreground px-2 py-3 text-sm">
                  {selectedDate
                    ? `No events for ${formatDate(selectedDate.toISOString(), {
                        month: "long",
                        day: "numeric",
                      })}.`
                    : "Select a date to see scheduled events."}
                </p>
              )}
            </RoadmapCalendarAgendaScroll>
          </div>
        </div>
      </section>
    )
  }
)
