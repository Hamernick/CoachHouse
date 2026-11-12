"use client"

import LocateFixedIcon from "lucide-react/dist/esm/icons/locate-fixed"
import MinusIcon from "lucide-react/dist/esm/icons/minus"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import LayoutGridIcon from "lucide-react/dist/esm/icons/layout-grid"
import type { ReactNode } from "react"

import { useRegisterAppShellCalendarTutorial } from "@/components/app-shell/calendar-action-context"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function WorkspaceCanvasSurfaceV2ViewportControls({
  tutorialCalendarButtonCallout,
  onTutorialCalendarButtonComplete,
  onRecenterView,
  onZoomIn,
  onZoomOut,
  layoutActions,
}: {
  tutorialCalendarButtonCallout?: { title: string; instruction: string } | null
  onTutorialCalendarButtonComplete?: (() => void) | undefined
  onRecenterView: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  layoutActions?: ReactNode
}) {
  useRegisterAppShellCalendarTutorial({
    tutorialCalendarButtonCallout: tutorialCalendarButtonCallout ?? null,
    onTutorialCalendarButtonComplete,
  })

  return (
    <div
      data-workspace-canvas-viewport-controls="true"
      className="pointer-events-none absolute right-2 bottom-[84px] z-50 flex items-start justify-end group-has-[[data-workspace-canvas-drawer-fullscreen=true]]/workspace-canvas-surface:hidden group-has-[[data-workspace-window-maximized=true]]/workspace-canvas-surface:hidden md:top-2 md:bottom-auto"
    >
      <div className="canvas-glass canvas-planning-material pointer-events-auto flex items-center gap-1 rounded-full border p-1 transition-[background-color] duration-180 ease-out">
        {layoutActions ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon"
                className="relative h-8 w-11 touch-manipulation rounded-full after:absolute after:inset-x-0 after:-inset-y-1.5 md:w-8 md:after:hidden"
                aria-label="Canvas layout" title="Canvas layout">
                <LayoutGridIcon className="h-4 w-4" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 max-w-[calc(100vw-1rem)] rounded-2xl p-1 text-left shadow-none" aria-label="Canvas layout">
              {layoutActions}
            </PopoverContent>
          </Popover>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"

          className="relative h-8 w-11 touch-manipulation rounded-full after:absolute after:inset-x-0 after:-inset-y-1.5 md:w-8 md:after:hidden"
          onClick={onZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <MinusIcon className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"

          className="relative h-8 w-11 touch-manipulation rounded-full after:absolute after:inset-x-0 after:-inset-y-1.5 md:w-8 md:after:hidden"
          onClick={onZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <PlusIcon className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"

          className="relative h-8 w-11 touch-manipulation rounded-full after:absolute after:inset-x-0 after:-inset-y-1.5 md:w-8 md:after:hidden"
          onClick={onRecenterView}
          aria-label="Recenter view"
          title="Recenter view"
        >
          <LocateFixedIcon className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
