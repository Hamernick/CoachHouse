"use client"

import { memo, type ReactNode } from "react"
import ChevronLeftIcon from "lucide-react/dist/esm/icons/chevron-left"
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right"
import CircleIcon from "lucide-react/dist/esm/icons/circle"

import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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

import { RoadmapCalendarDayWithEventDots } from "./roadmap-calendar-day-with-event-dots"
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
  personalEvents?: CalendarEvent[]
  googleCalendarControls?: ReactNode
  compactHeaderControls?: boolean
  today?: Date
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

export const RoadmapCalendarMonthAgendaPanel = memo(
  function RoadmapCalendarMonthAgendaPanel({
    compactHeaderControls = false,
    personalEvents = [],
    googleCalendarControls,
    today,
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
    const showTodayButton = !isSameCalendarMonth(month, today ?? new Date())

    return (
      <section
        className={cn(
          "border-border/60 bg-muted/45 flex max-h-[min(42rem,calc(100svh-5.5rem))] min-h-0 w-full flex-col overflow-hidden rounded-[30px] border p-2.5",
          className
        )}
      >
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

        <div
          className="bg-background flex min-h-0 flex-col rounded-[24px] px-3 py-3"

        >
          <Calendar
            mode="single"
            selected={selectedDate}
            month={month}
            today={today}
            onMonthChange={onMonthChange}
            onSelect={(date) => onSelectDate(date ?? undefined)}
            modifiers={{
              ...eventModifiers,
              google_calendar: (date) =>
                personalEvents.some((event) =>
                  calendarEventOccursOnDay(event, date)
                ),
            }}
            className="w-full shrink-0 bg-transparent p-0 [--cell-size:2.45rem] sm:[--cell-size:2.55rem]"
            classNames={{
              root: "w-full",
              months: "w-full",
              month: "w-full",
              month_grid: "w-full table-fixed border-collapse",
              month_caption: "sr-only",
              nav: "hidden",
              weekdays: "w-full border-b border-border/40",
              weekday:
                "w-[14.285714%] pb-2 text-center text-xs font-semibold text-muted-foreground/62",
              weeks: "w-full",
              week: "w-full",
              day: "w-[14.285714%] min-w-0 p-0 pt-2 text-center align-middle",
              today:
                "rounded-xl bg-transparent text-foreground data-[selected=true]:rounded-xl",
              outside: "text-muted-foreground/35",
            }}
            components={{ DayButton: RoadmapCalendarDayWithEventDots }}
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
