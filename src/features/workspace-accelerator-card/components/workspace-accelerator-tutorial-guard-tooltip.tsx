"use client"

import type { ReactNode } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  WORKSPACE_TUTORIAL_TOOLTIP_INVERSE_SURFACE_CLASSNAME,
  WORKSPACE_TUTORIAL_NEUTRAL_SURFACE_CLASSNAME,
} from "@/components/workspace/workspace-tutorial-theme"
import { cn } from "@/lib/utils"

export const WORKSPACE_ACCELERATOR_TUTORIAL_NEUTRAL_SURFACE_CLASSNAME =
  WORKSPACE_TUTORIAL_NEUTRAL_SURFACE_CLASSNAME

export const WORKSPACE_ACCELERATOR_TUTORIAL_GUARD_CHROME_CLASSNAME =
  cn(
    "max-w-52 text-left whitespace-normal",
    WORKSPACE_TUTORIAL_TOOLTIP_INVERSE_SURFACE_CLASSNAME,
  )

export function WorkspaceAcceleratorTutorialGuardTooltip({
  open,
  message,
  children,
  side = "top",
  align = "center",
  sideOffset = 8,
}: {
  open: boolean
  message: string | null
  children: ReactNode
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  sideOffset?: number
}) {
  if (!message) {
    return children
  }

  return (
    <Tooltip open={open}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={sideOffset}

        className={cn(
          WORKSPACE_ACCELERATOR_TUTORIAL_GUARD_CHROME_CLASSNAME,
        )}
      >
        {message}
      </TooltipContent>
    </Tooltip>
  )
}
