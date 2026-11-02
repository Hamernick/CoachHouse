"use client"

import { GripVerticalIcon } from "lucide-react"
import type { ComponentType, HTMLAttributes, ReactNode } from "react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

type PrimitiveProps = Record<string, unknown> & {
  children?: ReactNode
  className?: string
}

type ResizableModule = Record<string, ComponentType<PrimitiveProps> | undefined>

type ResizablePanelGroupProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onLayout"
> & {
  autoSaveId?: string | null
  direction?: "horizontal" | "vertical"
  keyboardResizeBy?: number | null
  onLayout?: (layout: number[]) => void
  orientation?: "horizontal" | "vertical"
  storage?: unknown
  tagName?: keyof HTMLElementTagNameMap
}

type ResizablePanelProps = Omit<HTMLAttributes<HTMLDivElement>, "onResize"> & {
  panelRef?: ResizablePrimitive.PanelProps["panelRef"]
  collapsedSize?: number | string
  collapsible?: boolean
  defaultSize?: number | string
  disabled?: boolean
  maxSize?: number | string
  minSize?: number | string
  onCollapse?: () => void
  onExpand?: () => void
  onResize?: (size: number, previousSize?: number) => void
}

type ResizableHandleProps = HTMLAttributes<HTMLDivElement> & {
  disabled?: boolean
  hitAreaMargins?: unknown
  onDragging?: (isDragging: boolean) => void
  withHandle?: boolean
}

const resizablePrimitive = ResizablePrimitive as unknown as ResizableModule

function getPrimitiveComponent(name: string): ComponentType<PrimitiveProps> {
  const component = resizablePrimitive[name]
  if (!component) {
    throw new Error(`Missing react-resizable-panels export: ${name}`)
  }
  return component
}

const PrimitivePanel = getPrimitiveComponent("Panel")
const PrimitivePanelGroupV3 = resizablePrimitive["PanelGroup"]
const PrimitivePanelGroupV4 = resizablePrimitive["Group"]
const PrimitivePanelGroup =
  PrimitivePanelGroupV3 ??
  PrimitivePanelGroupV4 ??
  getPrimitiveComponent("PanelGroup")
const PrimitiveResizeHandleV3 = resizablePrimitive["PanelResizeHandle"]
const PrimitiveResizeHandleV4 = resizablePrimitive["Separator"]
const PrimitiveResizeHandle =
  PrimitiveResizeHandleV3 ??
  PrimitiveResizeHandleV4 ??
  getPrimitiveComponent("PanelResizeHandle")

function ResizablePanelGroup({
  className,
  direction = "horizontal",
  orientation,
  ...props
}: ResizablePanelGroupProps) {
  const resolvedDirection = orientation ?? direction
  const directionProps = PrimitivePanelGroupV3
    ? { direction: resolvedDirection }
    : { orientation: resolvedDirection }

  return (
    <PrimitivePanelGroup
      {...(props as PrimitiveProps)}
      {...directionProps}
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full aria-[orientation=vertical]:flex-col",
        className
      )}
    />
  )
}

function ResizablePanel({ ...props }: ResizablePanelProps) {
  return (
    <PrimitivePanel
      data-slot="resizable-panel"
      {...(props as PrimitiveProps)}
    />
  )
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizableHandleProps) {
  return (
    <PrimitiveResizeHandle
      {...(props as PrimitiveProps)}
      data-slot="resizable-handle"
      className={cn(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        className
      )}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </PrimitiveResizeHandle>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
