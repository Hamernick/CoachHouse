"use client"

import { cn } from "@/lib/utils"

export type WorkspaceCalendarPreviewEvent = {
  id: string
  title: string
  startsAt: string
  allDay: boolean
  assignedRoles: readonly string[]
}

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "short" })
const dayFormatter = new Intl.DateTimeFormat(undefined, { day: "numeric" })
const headingFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
})
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
})

function startOfLocalDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function workspaceCalendarEventAccentClassName(
  assignedRoles: readonly string[]
) {
  if (assignedRoles.includes("board")) return "before:bg-emerald-500"
  if (assignedRoles.includes("staff")) return "before:bg-sky-500"
  if (assignedRoles.includes("admin")) return "before:bg-amber-500"
  return "before:bg-muted-foreground/70"
}

export function workspaceCalendarDateTileClassName({
  compact,
  interactive,
  isActive,
}: {
  compact: boolean
  interactive: boolean
  isActive: boolean
}) {
  return cn(
    "group relative grid aspect-square h-auto w-full min-w-0 place-items-center p-0 text-center",
    compact ? "rounded-md" : "rounded-lg",
    isActive
      ? "bg-foreground text-background"
      : "text-foreground bg-transparent",
    interactive && !isActive && "hover:bg-background/70 transition-colors"
  )
}

export function WorkspaceCalendarDateTileContent({
  compact,
  date,
  hasEvent,
  isActive,
  isToday,
}: {
  compact: boolean
  date: Date
  hasEvent: boolean
  isActive: boolean
  isToday: boolean
}) {
  return (
    <>
      <span className="grid translate-y-[-1px] place-items-center gap-0.5">
        <span
          className={cn(
            compact ? "text-[8px]" : "text-[10px]",
            "leading-none",
            isActive ? "text-background/75" : "text-muted-foreground"
          )}
        >
          {monthFormatter.format(date)}
        </span>
        <span
          className={cn(
            compact ? "text-sm" : "text-lg",
            "leading-none font-semibold tabular-nums"
          )}
        >
          {dayFormatter.format(date)}
        </span>
      </span>
      <span
        className={cn(
          compact
            ? "absolute top-1 right-1 h-1 w-1 rounded-full"
            : "absolute top-1.5 right-1.5 h-1 w-1 rounded-full",
          isToday
            ? isActive
              ? "bg-background/85"
              : "bg-foreground/70"
            : "bg-transparent"
        )}
        aria-hidden
      />
      <span
        className={cn(
          compact
            ? "absolute bottom-1 h-1 w-1 rounded-full"
            : "absolute bottom-1.5 h-1 w-1 rounded-full",
          hasEvent
            ? isActive
              ? "bg-background/80"
              : "bg-foreground/70"
            : "bg-transparent"
        )}
        aria-hidden
      />
    </>
  )
}

export const WORKSPACE_CALENDAR_EVENT_ROW_CLASS_NAME =
  "bg-muted/55 border-border/50 relative flex h-auto w-full flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 pl-6 text-left whitespace-normal before:absolute before:inset-y-1.5 before:left-2 before:w-1 before:rounded-full"

export function WorkspaceCalendarEventPreviewContent({
  invitesLabel,
  timeLabel,
  title,
}: {
  invitesLabel?: string | null
  timeLabel: string
  title: string
}) {
  return (
    <>
      <p className="text-foreground line-clamp-1 min-w-0 text-xs leading-tight font-medium [overflow-wrap:anywhere] break-words">
        {title}
      </p>
      <p className="text-muted-foreground line-clamp-1 min-w-0 text-[10px] leading-tight [overflow-wrap:anywhere] break-words">
        {timeLabel}
      </p>
      {invitesLabel ? (
        <p className="text-muted-foreground line-clamp-1 min-w-0 text-[10px] leading-tight [overflow-wrap:anywhere] break-words">
          {invitesLabel}
        </p>
      ) : null}
    </>
  )
}

export function WorkspaceCalendarDateStripPreview({
  className,
  events,
}: {
  className?: string
  events: WorkspaceCalendarPreviewEvent[]
}) {
  const selectedDate = startOfLocalDay(new Date())
  const days = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(selectedDate)
    date.setDate(selectedDate.getDate() + index)
    return date
  })
  const parsedEvents = events.flatMap((event) => {
    const date = new Date(event.startsAt)
    return Number.isNaN(date.getTime()) ? [] : [{ event, date }]
  })
  const eventDays = new Set(parsedEvents.map(({ date }) => dayKey(date)))
  const selectedEvents = parsedEvents.filter(({ date }) =>
    isSameCalendarDay(date, selectedDate)
  )
  const visibleEvents = (
    selectedEvents.length ? selectedEvents : parsedEvents
  ).slice(0, 2)

  return (
    <div
      className={cn(
        "flex size-full min-h-0 min-w-0 flex-col overflow-hidden p-2",
        className
      )}
      aria-label="Calendar preview"
    >
      <div className="grid min-w-0 grid-cols-5 gap-1.5">
        {days.map((date) => {
          const isActive = isSameCalendarDay(date, selectedDate)
          return (
            <div
              key={date.toISOString()}
              className={workspaceCalendarDateTileClassName({
                compact: true,
                interactive: false,
                isActive,
              })}
            >
              <WorkspaceCalendarDateTileContent
                compact
                date={date}
                hasEvent={eventDays.has(dayKey(date))}
                isActive={isActive}
                isToday={isActive}
              />
            </div>
          )
        })}
      </div>

      <div className="border-border/35 mt-2 min-h-0 flex-1 border-t pt-2">
        <p className="text-foreground truncate text-xs font-semibold">
          {headingFormatter.format(selectedDate)}
        </p>
        <p className="text-muted-foreground text-[10px]">
          {selectedEvents.length > 0
            ? `${selectedEvents.length} event${selectedEvents.length === 1 ? "" : "s"} on this day`
            : "No events on this day"}
        </p>
        {visibleEvents.length ? (
          <div className="mt-2 space-y-1.5">
            {visibleEvents.map(({ date, event }) => (
              <div
                key={event.id}
                className={cn(
                  WORKSPACE_CALENDAR_EVENT_ROW_CLASS_NAME,
                  workspaceCalendarEventAccentClassName(event.assignedRoles)
                )}
              >
                <WorkspaceCalendarEventPreviewContent
                  title={event.title}
                  timeLabel={
                    event.allDay ? "All day" : timeFormatter.format(date)
                  }
                  invitesLabel={
                    event.assignedRoles.length
                      ? `Invites: ${event.assignedRoles.join(", ")}`
                      : null
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground mt-2 text-xs">
            Add milestones in the full calendar to keep board rhythm visible.
          </p>
        )}
      </div>
    </div>
  )
}
