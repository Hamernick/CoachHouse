"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import {
  buildReactGrabDebugSurfaceRecord,
  debugSurfaceClass,
  type ReactGrabDebugSurfaceAttributes,
} from "@/lib/react-grab-debug-surface"
import { cn } from "@/lib/utils"

const TOOLTIP_SOURCE = "src/components/ui/tooltip.tsx"
const TOOLTIP_IMPORT = "@/components/ui/tooltip"
export const TOOLTIP_ARROW_CLASSNAME =
  "z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const reactGrabAttributes = props as ReactGrabDebugSurfaceAttributes
  const resolvedClassName = cn(
    "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 motion-reduce:animate-none",
    className
  )
  const debugRecord = buildReactGrabDebugSurfaceRecord({
    attributes: reactGrabAttributes,
    fallbackComponent: "TooltipContent",
    fallbackSource: TOOLTIP_SOURCE,
    defaultSlot: "content",
    defaultSurfaceKind: "content",
    className: resolvedClassName,
    classAssemblyFile: TOOLTIP_SOURCE,
    primitiveImport: TOOLTIP_IMPORT,
  })

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={
          debugRecord ? debugSurfaceClass(debugRecord) : resolvedClassName
        }
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow
          data-slot="tooltip-arrow"
          className={TOOLTIP_ARROW_CLASSNAME}
        />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
