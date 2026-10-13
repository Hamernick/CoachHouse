"use client"

import { useRef } from "react"
import MonitorCheckIcon from "lucide-react/dist/esm/icons/monitor-check"
import GripVerticalIcon from "lucide-react/dist/esm/icons/grip-vertical"
import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function WorkspacePeopleDrawerCanvasCell({
  person,
  placed,
  onAddToCanvas,
}: {
  person: OrgPersonWithImage
  placed: boolean
  onAddToCanvas: (personIds: string[]) => number
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const lastTap = useRef<{ x: number; y: number; time: number } | null>(null)
  const lastActivation = useRef(-Infinity)
  const showPerson = () => {
    const now = performance.now()
    if (now - lastActivation.current < 400) return
    lastActivation.current = now
    onAddToCanvas([person.id])
  }

  return (
    <div className="ml-auto flex items-center justify-end">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            draggable
            className="text-muted-foreground/70 group-hover:bg-muted group-hover:text-foreground size-11 touch-manipulation cursor-grab rounded-lg active:cursor-grabbing md:size-7"
            data-workspace-people-drag-handle="true"
            aria-label={`${placed ? "Show" : "Add"} ${person.name} on canvas`}
            title={placed ? undefined : `Drag to place ${person.name}, or double-click to show on canvas`}
            onClick={(event) => {
              event.stopPropagation()
              if (event.detail === 0) showPerson()
            }}
            onDoubleClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              showPerson()
            }}
            onPointerDown={(event) => {
              if (event.pointerType === "touch") {
                touchStart.current = { x: event.clientX, y: event.clientY }
              }
            }}
            onPointerCancel={() => {
              touchStart.current = null
              lastTap.current = null
            }}
            onPointerUp={(event) => {
              if (event.pointerType !== "touch" || !touchStart.current) return
              const start = touchStart.current
              touchStart.current = null
              if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) {
                lastTap.current = null
                return
              }
              const previous = lastTap.current
              const time = performance.now()
              if (
                previous && time - previous.time < 350 &&
                Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 20
              ) {
                event.preventDefault()
                lastTap.current = null
                showPerson()
              } else {
                lastTap.current = { x: event.clientX, y: event.clientY, time }
              }
            }}
          >
            {placed ? <MonitorCheckIcon className="size-4" aria-hidden /> : <GripVerticalIcon className="size-4" aria-hidden />}
          </Button>
        </TooltipTrigger>
        {placed ? <TooltipContent side="top" sideOffset={6}>On workspace</TooltipContent> : null}
      </Tooltip>
    </div>
  )
}
