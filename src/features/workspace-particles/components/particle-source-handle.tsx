"use client"

import { useId, type ReactNode } from "react"
import { useDraggable } from "@dnd-kit/core"
import GripVerticalIcon from "lucide-react/dist/esm/icons/grip-vertical"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { particleSourceKey } from "../lib"
import type { ParticleReference } from "../types"
import { useWorkspaceParticles } from "./particle-context"

export function ParticleSourceHandle({
  source,
  title,
  className,
  children,
  surfaceProps,
  clickLabel = "add",
  keyboardAccessible = true,
  showGrip = true,
  dragOnly = false,
  doubleClickToAdd = false,
}: {
  source: ParticleReference
  title: string
  className?: string
  children?: ReactNode
  surfaceProps?: Record<string, string>
  clickLabel?: "add" | "show"
  keyboardAccessible?: boolean
  showGrip?: boolean
  dragOnly?: boolean
  doubleClickToAdd?: boolean
}) {
  const controller = useWorkspaceParticles()
  const instance = useId()
  const key = particleSourceKey(source)
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `${instance}:${key}`,
    data: { sourceKey: key },
    disabled: !controller?.canEdit,
  })
  if (!controller?.canEdit) return null
  return (
    <Button
      ref={setNodeRef}
      type="button"
      variant="ghost"
      size="icon"
      {...attributes}
      {...listeners}
      {...surfaceProps}
      tabIndex={keyboardAccessible ? undefined : -1}
      aria-hidden={keyboardAccessible ? undefined : true}
      data-vaul-no-drag
      data-particle-source={key}
      aria-label={
        doubleClickToAdd
          ? `Drag ${title} to canvas, or double-click or press Enter to ${clickLabel}`
          : dragOnly
            ? `Drag ${title} to canvas`
            : `Drag ${title} to canvas, or press Enter to ${clickLabel}`
      }
      title={
        doubleClickToAdd
          ? `Drag ${title} to canvas, or double-click to ${clickLabel}`
          : `Drag ${title} to canvas`
      }
      className={cn(
        "nodrag nopan size-9 shrink-0 cursor-grab touch-none active:cursor-grabbing",
        className
      )}
      onClick={() => {
        if (!dragOnly && !doubleClickToAdd)
          controller.addFromSourceClick(source)
      }}
      onDoubleClick={() => {
        if (doubleClickToAdd) controller.addFromSourceClick(source)
      }}
      onKeyDown={(event) => {
        if (doubleClickToAdd && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          event.stopPropagation()
          if (!event.repeat) controller.addFromSourceClick(source)
          return
        }
        listeners?.onKeyDown?.(event)
      }}
    >
      {children ?? (showGrip ? <GripVerticalIcon /> : null)}
    </Button>
  )
}
