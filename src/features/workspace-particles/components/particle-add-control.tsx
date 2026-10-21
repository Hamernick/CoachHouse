"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { getReactGrabInspectionProps } from "@/components/dev/react-grab-surface"
import { PlusIcon } from "./shapeshift-icons"

export function ParticleAddControl({
  title,
  className,
  disabled,
  onAdd,
}: {
  title: string
  className?: string
  disabled: boolean
  onAdd: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={onAdd}
      aria-label={`Add ${title} to canvas`}
      title="Add to canvas"
      {...getReactGrabInspectionProps("overlay")}
      className={cn(
        "nodrag nopan absolute top-0 right-3 size-8 rounded-full [@media(pointer:coarse)]:size-11",
        className
          ? "[@media(pointer:coarse)]:translate-x-0"
          : "[@media(pointer:coarse)]:translate-x-1.5 [@media(pointer:coarse)]:-translate-y-1.5",
        className
      )}
    >
      <PlusIcon aria-hidden="true" />
    </Button>
  )
}
