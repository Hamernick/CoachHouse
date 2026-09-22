"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  isWithinInterval,
  startOfWeek,
} from "date-fns"
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  Plus,
} from "@phosphor-icons/react/dist/ssr"

import type {
  ProjectActivityItem,
  TimelineTask,
} from "@/features/platform-admin-dashboard/upstream/lib/data/project-details"
import { CoachingAvatarGroup } from "@/components/coaching/coaching-avatar-group"
import { Badge } from "@/features/platform-admin-dashboard/upstream/components/ui/badge"
import { Button } from "@/features/platform-admin-dashboard/upstream/components/ui/button"
import { Calendar } from "@/features/platform-admin-dashboard/upstream/components/ui/calendar"
import { Input } from "@/features/platform-admin-dashboard/upstream/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/features/platform-admin-dashboard/upstream/components/ui/popover"
import { Separator } from "@/features/platform-admin-dashboard/upstream/components/ui/separator"

export type TimelineProgram = {
  endAt: string | null
  id: string
  startAt: string | null
  statusLabel: string
  title: string
}

type TimelineGanttProps = {
  activity?: ProjectActivityItem[]
  onCreateTask?: () => void
  programs?: TimelineProgram[]
  tasks: TimelineTask[]
}

type TimelineRow = {
  assignee?: TimelineTask["assignee"]
  endDate: Date | null
  id: string
  kind: "Program" | "Task"
  name: string
  startDate: Date | null
  statusLabel: string
}

const timelineGridStyle = {
  gridTemplateColumns: "clamp(7rem, 26vw, 15rem) minmax(0, 1fr)",
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function toValidDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toTitleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function buildTimelineRows(tasks: TimelineTask[], programs: TimelineProgram[]) {
  return [
    ...tasks.map<TimelineRow>((task) => ({
      assignee: task.assignee,
      endDate: new Date(task.endDate.getUTCFullYear(), task.endDate.getUTCMonth(), task.endDate.getUTCDate()),
      id: `task:${task.id}`,
      kind: "Task",
      name: task.name,
      startDate: new Date(task.startDate.getUTCFullYear(), task.startDate.getUTCMonth(), task.startDate.getUTCDate()),
      statusLabel: toTitleCase(task.status),
    })),
    ...programs.map<TimelineRow>((program) => {
      const startDate = toValidDate(program.startAt)
      const endDate = toValidDate(program.endAt)
      return {
        endDate: endDate ?? startDate,
        id: `program:${program.id}`,
        kind: "Program",
        name: program.title,
        startDate: startDate ?? endDate,
        statusLabel: program.statusLabel,
      }
    }),
  ]
}

function rowIntersectsRange(row: TimelineRow, start: Date, end: Date) {
  return Boolean(
    row.startDate && row.endDate && row.startDate < end && row.endDate >= start
  )
}

export function TimelineGantt({
  activity = [],
  onCreateTask,
  programs = [],
  tasks,
}: TimelineGanttProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [rangeStart, setRangeStart] = useState<Date | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputId = useId()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const rows = useMemo(
    () => buildTimelineRows(tasks, programs),
    [programs, tasks]
  )
  const datedStarts = [
    ...rows.map((row) => row.startDate),
    ...activity.map((item) => item.occurredAt),
  ].filter((date): date is Date => Boolean(date))
  const initialDate = datedStarts.length
    ? new Date(Math.min(...datedStarts.map((date) => date.getTime())))
    : new Date()
  const effectiveRangeStart = rangeStart ?? initialDate
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(startOfWeek(effectiveRangeStart, { weekStartsOn: 1 }), index)
  )
  const today = new Date()
  const rangeStartDate = days[0]
  const rangeEndDate = addDays(days[days.length - 1], 1)
  const todayInRange = isWithinInterval(today, {
    start: rangeStartDate,
    end: rangeEndDate,
  })
  const todayIndex = clamp(
    differenceInCalendarDays(today, rangeStartDate),
    0,
    days.length - 1
  )
  const normalizedQuery = query.trim().toLowerCase()
  const matchingRows = rows.filter(
    (row) =>
      !normalizedQuery ||
      row.name.toLowerCase().includes(normalizedQuery) ||
      row.kind.toLowerCase().includes(normalizedQuery) ||
      row.statusLabel.toLowerCase().includes(normalizedQuery)
  )
  const visibleRows = matchingRows.filter(
    (row) =>
      (!row.startDate && !row.endDate) ||
      rowIntersectsRange(row, rangeStartDate, rangeEndDate)
  )
  const visibleActivity = activity
    .filter(
      (item) =>
        item.occurredAt >= rangeStartDate && item.occurredAt < rangeEndDate
    )
    .filter(
      (item) =>
        !normalizedQuery ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.entityType.toLowerCase().includes(normalizedQuery) ||
        item.eventType.toLowerCase().includes(normalizedQuery)
    )
    .sort(
      (left, right) => right.occurredAt.getTime() - left.occurredAt.getTime()
    )
  const activityByDay = days.map((day) =>
    visibleActivity.filter((item) => isSameDay(item.occurredAt, day))
  )
  const monthLabel = `${format(days[0], "MMM d")} – ${format(
    days[days.length - 1],
    "MMM d, yyyy"
  )}`

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  const handlePrevious = () => {
    setRangeStart(addDays(rangeStartDate, -7))
  }

  const handleNext = () => {
    setRangeStart(addDays(rangeStartDate, 7))
  }

  const handleToday = () => {
    setRangeStart(startOfWeek(today, { weekStartsOn: 1 }))
  }

  const handleSearchToggle = () => {
    setSearchOpen((open) => {
      if (open) setQuery("")
      return !open
    })
  }

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-foreground text-base font-semibold">
          Expected Timeline
        </h2>
        {onCreateTask ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={onCreateTask}
          >
            <Plus data-icon="inline-start" aria-hidden />
            Add task
          </Button>
        ) : null}
      </div>

      <div className="border-border mt-4 min-w-0 overflow-hidden rounded-lg border">
        <div className="grid min-w-0" style={timelineGridStyle}>
          <div className="border-border bg-muted/20 text-muted-foreground border-r px-3 py-3 text-sm font-medium sm:px-4">
            Name
          </div>
          <div className="border-border bg-background min-w-0 border-b px-2 py-2 sm:px-4">
            <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="text-muted-foreground truncate text-xs tabular-nums">
                {monthLabel}
              </div>
              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Previous week"
                  onClick={handlePrevious}
                >
                  <CaretLeft aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleToday}
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Next week"
                  onClick={handleNext}
                >
                  <CaretRight aria-hidden />
                </Button>
                <Badge variant="outline">Week</Badge>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Jump to date"
                    >
                      <CalendarBlank aria-hidden />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={rangeStartDate}
                      defaultMonth={rangeStartDate}
                      onSelect={(date) => {
                        if (!date) return
                        setRangeStart(startOfWeek(date, { weekStartsOn: 1 }))
                        setDatePickerOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant={searchOpen ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label="Search timeline"
                  aria-controls={searchInputId}
                  aria-expanded={searchOpen}
                  onClick={handleSearchToggle}
                >
                  <MagnifyingGlass aria-hidden />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {searchOpen ? (
          <div className="border-border border-t p-3">
            <label htmlFor={searchInputId} className="sr-only">
              Search tasks, programs, and activity
            </label>
            <Input
              ref={searchInputRef}
              id={searchInputId}
              type="search"
              value={query}
              placeholder="Search timeline…"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return
                setQuery("")
                setSearchOpen(false)
              }}
            />
          </div>
        ) : null}

        <div className="grid min-w-0" style={timelineGridStyle}>
          <div className="border-border bg-muted/10 border-r" />
          <div
            className="bg-muted/10 grid min-w-0 gap-1 px-2 py-2 sm:px-4"
            style={{
              gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
            }}
          >
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className="text-muted-foreground flex min-w-0 flex-col text-[10px] leading-4 sm:text-[11px]"
              >
                <span className="truncate font-medium">
                  {format(day, "EEE")}
                </span>
                <span className="text-foreground text-xs tabular-nums">
                  {format(day, "d")}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="relative min-w-0">
          {todayInRange ? (
            <div
              className="pointer-events-none absolute inset-0 grid"
              style={timelineGridStyle}
              aria-hidden
            >
              <span />
              <span className="relative">
                <span
                  className="bg-primary absolute inset-y-0 w-px"
                  style={{
                    left: `${((todayIndex + 0.5) / days.length) * 100}%`,
                  }}
                />
              </span>
            </div>
          ) : null}

          {visibleRows.length ? (
            visibleRows.map((row, rowIndex) => {
              const startOffset = row.startDate
                ? differenceInCalendarDays(row.startDate, days[0])
                : 0
              const endOffset = row.endDate
                ? differenceInCalendarDays(row.endDate, days[0])
                : startOffset
              const totalDays = days.length
              const leftPct = clamp((startOffset / totalDays) * 100, 0, 100)
              const rightPct = clamp((endOffset / totalDays) * 100, 0, 100)
              const minWidthPct = (1 / totalDays) * 100
              const widthPct = clamp(
                rightPct - leftPct + minWidthPct,
                minWidthPct,
                100 - leftPct
              )

              return (
                <div key={row.id}>
                  <div className="grid min-w-0" style={timelineGridStyle}>
                    <div className="border-border min-w-0 border-r px-3 py-2 sm:px-4">
                      <p className="text-foreground truncate text-sm">
                        {row.name}
                      </p>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                        {row.assignee ? (
                          <CoachingAvatarGroup size="xs" label="Task assignee" avatars={[{
                            id: row.assignee.id, name: row.assignee.name, imageUrl: row.assignee.avatarUrl ?? null,
                          }]} />
                        ) : row.kind === "Task" ? <span className="text-muted-foreground text-[11px]">Unassigned</span> : null}
                        <Badge
                          variant={
                            row.kind === "Program" ? "secondary" : "outline"
                          }
                        >
                          {row.kind}
                        </Badge>
                        <span className="text-muted-foreground truncate text-[11px]">
                          {row.statusLabel}
                        </span>
                      </div>
                    </div>
                    <div className="relative min-w-0 px-2 sm:px-4">
                      <div
                        className="grid"
                        style={{
                          gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                        }}
                      >
                        {days.map((day) => (
                          <div key={day.toISOString()} className="h-12" />
                        ))}
                      </div>
                      {row.startDate && row.endDate ? (
                        <div
                          className="border-border bg-muted absolute top-1/2 flex h-7 -translate-y-1/2 items-center rounded-md border px-2"
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          title={`${row.name} · ${row.statusLabel}`}
                        >
                          <span className="text-foreground truncate text-xs">
                            {row.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground absolute inset-0 flex items-center px-3 text-xs">
                          Dates not set
                        </span>
                      )}
                    </div>
                  </div>
                  {rowIndex < visibleRows.length - 1 ? <Separator /> : null}
                </div>
              )
            })
          ) : (
            <div className="grid min-w-0" style={timelineGridStyle}>
              <div className="border-border border-r" />
              <p className="text-muted-foreground p-4 text-sm">
                {normalizedQuery
                  ? "No matching items in this week."
                  : "No tasks or programs scheduled in this week."}
              </p>
            </div>
          )}
          {visibleActivity.length ? (
            <>
              <Separator />
              <div
                className="grid min-w-0"
                style={timelineGridStyle}
                data-timeline-activity-row
              >
                <div className="border-border min-w-0 border-r px-3 py-2 sm:px-4">
                  <p className="text-foreground truncate text-sm">Activity</p>
                  <p className="text-muted-foreground mt-1 truncate text-[11px]">
                    Recorded events
                  </p>
                </div>
                <div
                  className="grid min-w-0"
                  style={{
                    gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                  }}
                >
                  {activityByDay.map((events, index) => (
                    <div
                      key={days[index].toISOString()}
                      className="relative h-12 min-w-0"
                    >
                      {events.length ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="absolute inset-x-1 top-1/2 h-7 min-w-0 -translate-y-1/2 rounded-md px-1 text-xs tabular-nums"
                              data-timeline-activity-bar
                              aria-label={`${events.length} activity events on ${format(days[index], "MMMM d, yyyy")}: ${events.map((event) => event.title).join(", ")}`}
                            >
                              {events.length}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-72 max-w-[calc(100vw-2rem)] p-3">
                            <p className="mb-2 text-sm font-medium">
                              {format(days[index], "EEEE, MMMM d")}
                            </p>
                            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                              {events.map((event) => (
                                <li key={event.id} className="break-words">{event.title}</li>
                              ))}
                            </ul>
                          </PopoverContent>
                        </Popover>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}
