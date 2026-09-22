"use client"

import type { ComponentProps } from "react"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { RoadmapCalendarDayWithEventDots } from "./roadmap-calendar-day-with-event-dots"

function PreviewDay(
  props: ComponentProps<typeof RoadmapCalendarDayWithEventDots>
) {
  return <RoadmapCalendarDayWithEventDots {...props} readOnly />
}

/** The month panel and catalog share the same weekday, date, and event-dot grid. */
export function RoadmapCalendarMonthGrid({
  month,
  selectedDate,
  modifiers,
  onMonthChange,
  onSelectDate,
  preview = false,
}: {
  month: Date
  selectedDate?: Date
  modifiers?: ComponentProps<typeof Calendar>["modifiers"]
  onMonthChange?: (date: Date) => void
  onSelectDate?: (date: Date | undefined) => void
  preview?: boolean
}) {
  return (
    <Calendar
      mode="single"
      selected={selectedDate}
      month={month}
      onMonthChange={onMonthChange}
      onSelect={(date) => onSelectDate?.(date ?? undefined)}
      modifiers={modifiers}
      hideNavigation={preview}
      className={cn(
        "w-full shrink-0 bg-transparent p-0 [--cell-size:2.45rem] sm:[--cell-size:2.55rem]",
        preview && "[--cell-size:1.75rem] sm:[--cell-size:1.75rem]"
      )}
      classNames={{
        root: "w-full",
        months: "w-full",
        month: "w-full",
        month_grid: "w-full table-fixed border-collapse",
        month_caption: "sr-only",
        nav: "hidden",
        weekdays: "w-full border-b border-border/40",
        weekday: cn(
          "w-[14.285714%] pb-2 text-center text-xs font-semibold text-muted-foreground/62",
          preview && "pb-1 text-[10px]"
        ),
        weeks: "w-full",
        week: "w-full",
        day: cn(
          "w-[14.285714%] min-w-0 p-0 pt-2 text-center align-middle",
          preview && "pt-1"
        ),
        today:
          "rounded-xl bg-transparent text-foreground data-[selected=true]:rounded-xl",
        outside: "text-muted-foreground/35",
      }}
      components={{
        DayButton: preview ? PreviewDay : RoadmapCalendarDayWithEventDots,
      }}
    />
  )
}
