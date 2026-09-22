import type { ComponentProps } from "react"

import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { CalendarDayButton } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

import {
  ROADMAP_CALENDAR_EVENT_MODIFIER_BY_TYPE,
  ROADMAP_CALENDAR_EVENT_TYPE_META,
  ROADMAP_CALENDAR_EVENT_TYPE_ORDER,
} from "./roadmap-calendar-event-style"

const ROADMAP_CALENDAR_DAY_OWNER_PROPS = getReactGrabOwnerProps({
  ownerId: "roadmap-calendar-month-agenda:day",
  component: "RoadmapCalendarDayWithEventDots",
  source:
    "src/components/roadmap/roadmap-calendar/components/roadmap-calendar-day-with-event-dots.tsx",
  slot: "day",
  primitiveImport: "@/components/ui/calendar",
})

export function RoadmapCalendarDayWithEventDots({
  className,
  children,
  modifiers,
  readOnly = false,
  ...props
}: ComponentProps<typeof CalendarDayButton> & { readOnly?: boolean }) {
  const visibleDots = ROADMAP_CALENDAR_EVENT_TYPE_ORDER.filter((eventType) =>
    Boolean(modifiers?.[ROADMAP_CALENDAR_EVENT_MODIFIER_BY_TYPE[eventType]])
  ).slice(0, 3)

  const dayClassName = cn(
    className,
    "text-foreground relative mx-auto size-(--cell-size) min-h-10 min-w-0 rounded-xl border border-transparent bg-transparent text-sm font-semibold tabular-nums",
    "hover:bg-muted/35 focus-visible:ring-ring/45 focus-visible:ring-2",
    "data-[selected-single=true]:!border-border/50 data-[selected-single=true]:!bg-muted/75 data-[selected-single=true]:!text-foreground data-[selected-single=true]:!shadow-none",
    "group-data-[focused=true]/day:ring-ring/35 group-data-[focused=true]/day:ring-2",
    "[&>span]:!opacity-100",
    modifiers?.today && "border-border/55 bg-background hover:bg-background",
    modifiers?.outside && "text-muted-foreground/35",
    readOnly && "pointer-events-none block h-7 min-h-0 w-full max-w-7 rounded-md"
  )
  const content = (
    <>
      <span
        className={cn(
          "absolute inset-x-0 top-2 text-center !text-sm leading-none",
          readOnly && "top-1 !text-xs"
        )}
      >
        {children}
      </span>
      {visibleDots.length > 0 || modifiers?.google_calendar ? (
        <span
          className={cn(
            "absolute inset-x-0 bottom-1.5 flex justify-center gap-1",
            readOnly && "bottom-0.5 gap-0.5 [&>span]:size-1"
          )}
          aria-hidden
        >
          {modifiers?.google_calendar ? (
            <span className="bg-foreground size-1.5 rounded-full" />
          ) : null}
          {visibleDots.map((eventType) => (
            <span
              key={eventType}
              className={cn(
                "size-1.5 rounded-full",
                ROADMAP_CALENDAR_EVENT_TYPE_META[eventType].dotClassName
              )}
            />
          ))}
        </span>
      ) : null}
    </>
  )
  return readOnly ? (
    <span
      className={dayClassName}
      data-selected-single={Boolean(modifiers.selected)}
    >
      {content}
    </span>
  ) : (
    <CalendarDayButton
      {...props}
      {...ROADMAP_CALENDAR_DAY_OWNER_PROPS}
      modifiers={modifiers}
      className={dayClassName}
    >
      {content}
    </CalendarDayButton>
  )
}
