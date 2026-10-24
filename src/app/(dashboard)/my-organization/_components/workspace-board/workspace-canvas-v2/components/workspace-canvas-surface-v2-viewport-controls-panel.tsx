"use client"

import LocateFixedIcon from "lucide-react/dist/esm/icons/locate-fixed"
import MinusIcon from "lucide-react/dist/esm/icons/minus"
import PlusIcon from "lucide-react/dist/esm/icons/plus"

import { useRegisterAppShellCalendarTutorial } from "@/components/app-shell/calendar-action-context"

import { Button } from "@/components/ui/button"

export function WorkspaceCanvasSurfaceV2ViewportControls({
  tutorialCalendarButtonCallout,
  onTutorialCalendarButtonComplete,
  onRecenterView,
  onZoomIn,
  onZoomOut,
}: {
  tutorialCalendarButtonCallout?: { title: string; instruction: string } | null
  onTutorialCalendarButtonComplete?: (() => void) | undefined
  onRecenterView: () => void
  onZoomIn: () => void
  onZoomOut: () => void
}) {
  useRegisterAppShellCalendarTutorial({
    tutorialCalendarButtonCallout: tutorialCalendarButtonCallout ?? null,
    onTutorialCalendarButtonComplete,
  })

  return (
    <div
      data-workspace-canvas-viewport-controls="true"
      className="pointer-events-none absolute right-2 bottom-[84px] z-10 flex items-start justify-end group-has-[[data-workspace-canvas-drawer-fullscreen=true]]/workspace-canvas-surface:hidden md:top-2 md:bottom-auto"
    >
      <div className="border-border/70 bg-card/92 pointer-events-auto flex items-center gap-1 rounded-full border p-1 shadow-none backdrop-blur transition-[background-color] duration-180 ease-out">
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
