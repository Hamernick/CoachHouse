"use client"

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import PlusIcon from "lucide-react/dist/esm/icons/plus"

import { ScrollFadeEffect } from "@/components/scroll-fade-effect"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  formatCalendarRecurrence,
  getRoadmapCalendarEventTypeLabel,
  ROADMAP_CALENDAR_PRESETS,
  type RoadmapCalendarEvent,
  type RoadmapCalendarEventInput,
} from "@/lib/roadmap/calendar"
import { cn } from "@/lib/utils"

import { ROLE_OPTIONS } from "../constants"
import { ROADMAP_CALENDAR_EVENT_TYPE_META } from "./roadmap-calendar-event-style"

type OpenCreateHandler = (preset?: {
  title?: string
  eventType?: RoadmapCalendarEventInput["eventType"]
}) => void

const ROLE_LABEL_BY_ID = Object.fromEntries(
  ROLE_OPTIONS.map((role) => [role.id, role.label])
)

export function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

export function isSameCalendarMonth(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  )
}

export function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date)
}

export function formatAgendaHeading({
  selectedDate,
  eventCount,
}: {
  selectedDate: Date | undefined
  eventCount: number
}) {
  if (!selectedDate) return "EVENTS"
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
    .format(selectedDate)
    .toUpperCase()

  return `${dateLabel} · ${eventCount} EVENT${eventCount === 1 ? "" : "S"}`
}

export const RoadmapCalendarAddEventMenu = memo(
  function RoadmapCalendarAddEventMenu({
    disabled,
    iconOnly = false,
    onOpenCreate,
  }: {
    disabled: boolean
    iconOnly?: boolean
    onOpenCreate: OpenCreateHandler
  }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size={iconOnly ? "icon" : "default"}
            className={cn(
              "rounded-full shadow-none",
              iconOnly ? "size-8" : "h-8 justify-start px-3 text-sm font-medium"
            )}
            disabled={disabled}
            aria-label={iconOnly ? "Add event" : undefined}
            title={
              disabled
                ? "Only organization owners, admins, or allowed staff can add calendar events."
                : "Add event"
            }
          >
            <span className="bg-muted text-muted-foreground inline-flex size-5 items-center justify-center rounded-full">
              <PlusIcon data-icon="inline-start" aria-hidden />
            </span>
            {iconOnly ? null : "Add event"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            {ROADMAP_CALENDAR_PRESETS.map((preset) => (
              <DropdownMenuItem
                key={preset.id}
                onSelect={() =>
                  onOpenCreate({
                    title: preset.title,
                    eventType: preset.eventType,
                  })
                }
              >
                {preset.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => onOpenCreate({})}>
              Custom event…
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
)

export const RoadmapCalendarAgendaRow = memo(function RoadmapCalendarAgendaRow({
  event,
  canManageCalendar,
  formatTimeRange,
  onEditEvent,
}: {
  event: RoadmapCalendarEvent
  canManageCalendar: boolean
  formatTimeRange: (event: RoadmapCalendarEvent) => string
  onEditEvent: (event: RoadmapCalendarEvent) => void
}) {
  const meta = ROADMAP_CALENDAR_EVENT_TYPE_META[event.eventType]
  const roleLabels = event.assignedRoles
    .map((role) => ROLE_LABEL_BY_ID[role])
    .filter((label): label is string => Boolean(label))
  const content = (
    <span className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 whitespace-normal">
      <span
        className={cn("mt-1 size-2.5 rounded-full", meta.dotClassName)}
        aria-hidden
      />
      <span className="flex min-w-0 flex-col gap-1 text-left">
        <span
          className={cn(
            "text-foreground line-clamp-2 text-sm leading-tight font-medium",
            event.status === "canceled" &&
              "text-muted-foreground decoration-muted-foreground/60 line-through"
          )}
        >
          {event.title}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-muted-foreground/70 shrink-0 text-xs tabular-nums">
            {event.allDay ? "all day" : formatTimeRange(event)}
          </span>
          <Badge
            variant="secondary"
            className={cn(
              "w-fit shrink-0 rounded-full border-0 px-2 py-0.5 text-[10px] leading-none",
              meta.badgeClassName
            )}
          >
            {getRoadmapCalendarEventTypeLabel(event.eventType)}
          </Badge>
          {event.recurrence ? (
            <span className="text-muted-foreground min-w-0 truncate text-xs">
              {formatCalendarRecurrence(event.recurrence)}
            </span>
          ) : null}
          {roleLabels.length > 0 ? (
            <span className="text-muted-foreground min-w-0 truncate text-xs">
              {roleLabels.join(", ")}
            </span>
          ) : null}
          {event.status === "canceled" ? (
            <Badge
              variant="outline"
              className="h-5 rounded-full px-1.5 text-[10px]"
            >
              Canceled
            </Badge>
          ) : null}
        </span>
      </span>
    </span>
  )

  if (!canManageCalendar && !event.source) {
    return <div className="rounded-xl px-1 py-2">{content}</div>
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="hover:bg-muted/35 h-auto w-full justify-start rounded-xl px-1 py-2 whitespace-normal"
      onClick={() => onEditEvent(event)}
      aria-label={event.source ? `Open ${event.title} on canvas` : `Edit ${event.title}`}
    >
      {content}
    </Button>
  )
})

export const RoadmapCalendarAgendaScroll = memo(
  function RoadmapCalendarAgendaScroll({
    children,
    fadeEligible,
  }: {
    children: ReactNode
    fadeEligible: boolean
  }) {
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const [hasScrollableOverflow, setHasScrollableOverflow] = useState(false)

    const updateScrollableOverflow = useCallback(() => {
      const node = scrollRef.current
      const next = Boolean(
        fadeEligible && node && node.scrollHeight > node.clientHeight + 1
      )

      setHasScrollableOverflow((previous) =>
        previous === next ? previous : next
      )
    }, [fadeEligible])

    useEffect(() => {
      updateScrollableOverflow()
    }, [children, updateScrollableOverflow])

    useEffect(() => {
      const node = scrollRef.current
      if (!node) return

      updateScrollableOverflow()

      const frameId = window.requestAnimationFrame(updateScrollableOverflow)
      window.addEventListener("resize", updateScrollableOverflow)

      const resizeObserver =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(updateScrollableOverflow)
      resizeObserver?.observe(node)
      Array.from(node.children).forEach((child) =>
        resizeObserver?.observe(child)
      )

      const mutationObserver =
        typeof MutationObserver === "undefined"
          ? null
          : new MutationObserver(updateScrollableOverflow)
      mutationObserver?.observe(node, {
        childList: true,
        characterData: true,
        subtree: true,
      })

      return () => {
        window.cancelAnimationFrame(frameId)
        window.removeEventListener("resize", updateScrollableOverflow)
        resizeObserver?.disconnect()
        mutationObserver?.disconnect()
      }
    }, [children, updateScrollableOverflow])

    const showScrollFade = fadeEligible && hasScrollableOverflow

    return (
      <ScrollFadeEffect
        ref={scrollRef}
        enabled={showScrollFade}
        className="mt-3 flex max-h-[clamp(6.5rem,30dvh,15rem)] min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain pt-1 pr-1 pb-4 [--mask-height:1.5rem] [--scroll-buffer:1rem]"
      >
        {children}
      </ScrollFadeEffect>
    )
  }
)
