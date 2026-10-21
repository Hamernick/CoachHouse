"use client"

import { useEffect, useRef, useState, type PointerEvent } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  formatTimelineDay,
  shiftDay,
  timelineGeometry,
} from "../../lib/project-timeline"

type Drag = {
  pointer: number
  x: number
  type: "move" | "start" | "end"
  delta: number
}
export function MemberWorkspaceProjectTimelineDraggableBar({
  name,
  start,
  end,
  origin,
  days,
  cellWidth,
  disabled,
  task,
  onEdit,
  onChange,
  onReveal,
}: {
  name: string
  start: string
  end: string
  origin: string
  days: number
  cellWidth: number
  disabled: boolean
  task?: boolean
  onEdit: () => void
  onChange: (start: string, end: string) => void
  onReveal: (day: string) => void
}) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const gesture = useRef<Drag | null>(null),
    suppressClick = useRef(false)
  useEffect(
    () => () => {
      gesture.current = null
    },
    []
  )
  const geometry = timelineGeometry(start, end, origin, days, cellWidth)
  const pointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    type: Drag["type"]
  ) => {
    if (disabled || event.button !== 0 || !event.isPrimary) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = {
      pointer: event.pointerId,
      x: event.clientX,
      type,
      delta: 0,
    }
    setDrag(gesture.current)
  }
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!gesture.current || gesture.current.pointer !== event.pointerId) return
    gesture.current = {
      ...gesture.current,
      delta: event.clientX - gesture.current.x,
    }
    setDrag(gesture.current)
  }
  const finish = (event: PointerEvent<HTMLButtonElement>, cancel = false) => {
    const current = gesture.current
    if (!current || current.pointer !== event.pointerId) return
    gesture.current = null
    setDrag(null)
    suppressClick.current = Math.abs(event.clientX - current.x) > 4
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    if (cancel || disabled) return
    const delta = Math.round((event.clientX - current.x) / cellWidth)
    if (!delta) return
    const nextStart = current.type === "end" ? start : shiftDay(start, delta)
    const nextEnd = current.type === "start" ? end : shiftDay(end, delta)
    if (nextStart && nextEnd && nextStart > nextEnd) return
    onChange(nextStart, nextEnd)
  }
  const pointerHandlers = {
    onPointerMove: pointerMove,
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => finish(event),
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) =>
      finish(event, true),
    onLostPointerCapture: () => {
      gesture.current = null
      setDrag(null)
    },
  }
  if (!geometry)
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        className="sticky left-2 my-1"
        onClick={onEdit}
      >
        {disabled ? "No dates" : "Set dates"}
      </Button>
    )
  if (geometry.outside)
    return (
      <Button
        variant="ghost"
        size="sm"
        className="sticky left-2 my-1"
        onClick={() => onReveal(geometry.date)}
      >
        Show {formatTimelineDay(geometry.date)}
      </Button>
    )
  const deltaDays = drag ? Math.round(drag.delta / cellWidth) : 0
  const preview = drag
    ? timelineGeometry(
        drag.type === "end" ? start : shiftDay(start, deltaDays),
        drag.type === "start" ? end : shiftDay(end, deltaDays),
        origin,
        days,
        cellWidth
      )
    : geometry
  const layout = preview && !preview.outside ? preview : geometry
  const label = !start
    ? `Due ${formatTimelineDay(end)}`
    : !end
      ? `Starts ${formatTimelineDay(start)}`
      : `${formatTimelineDay(start)} – ${formatTimelineDay(end)}`
  return (
    <div
      className={cn("absolute top-2 h-8 select-none", drag && "z-20")}
      style={{ left: layout.left, width: Math.max(8, layout.width) }}
      data-timeline-bar={name}
    >
      <Button
        variant="secondary"
        className={cn(
          "h-full w-full justify-start overflow-hidden rounded-md border px-3",
          task && "border-primary/30 bg-primary/10",
          !disabled && "cursor-grab touch-none",
          drag && "opacity-75"
        )}
        title={`${name}: ${label}`}
        aria-label={`${disabled ? "View" : "Edit"} dates for ${name}: ${label}`}
        disabled={disabled}
        {...pointerHandlers}
        onPointerDown={(event) => pointerDown(event, "move")}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false
            return
          }
          onEdit()
        }}
      >
        <span className="truncate text-xs">
          {name} · {label}
        </span>
      </Button>
      {!disabled &&
        start &&
        end &&
        (["start", "end"] as const).map(
          (edge) =>
            (edge === "start"
              ? !geometry.clippedStart
              : !geometry.clippedEnd) && (
              <Button
                key={edge}
                variant="ghost"
                size="icon"
                tabIndex={-1}
                aria-label={`Resize ${edge} of ${name}`}
                className={cn(
                  "absolute top-0 h-8 w-2 cursor-col-resize touch-none rounded-sm p-0",
                  edge === "start" ? "left-0" : "right-0"
                )}
                {...pointerHandlers}
                onPointerDown={(event) => pointerDown(event, edge)}
                onClick={() => {
                  if (!suppressClick.current) onEdit()
                  suppressClick.current = false
                }}
              />
            )
        )}
    </div>
  )
}
