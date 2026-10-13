"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"

import FocusIcon from "lucide-react/dist/esm/icons/focus"
import GripIcon from "lucide-react/dist/esm/icons/grip"
import InfoIcon from "lucide-react/dist/esm/icons/info"
import MousePointer2Icon from "lucide-react/dist/esm/icons/mouse-pointer-2"
import MoveIcon from "lucide-react/dist/esm/icons/move"
import PanelLeftOpenIcon from "lucide-react/dist/esm/icons/panel-left-open"
import XIcon from "lucide-react/dist/esm/icons/x"
import ZoomInIcon from "lucide-react/dist/esm/icons/zoom-in"
import type { LucideIcon } from "lucide-react"

import {
  getReactGrabOwnerProps,
  getReactGrabLinkedSurfaceProps,
} from "@/components/dev/react-grab-surface"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type WorkspaceCanvasHelpItem = {
  icon: LucideIcon
  label: string
  description: string
}

const WORKSPACE_CANVAS_HELP_ITEMS: WorkspaceCanvasHelpItem[] = [
  {
    icon: MoveIcon,
    label: "Pan canvas",
    description:
      "Hold Space and drag, use the middle/right mouse button, or swipe with two fingers on a trackpad. Touch: drag empty space.",
  },
  {
    icon: FocusIcon,
    label: "Focus a card",
    description:
      "Double-click a card to center it and fit it in the workspace.",
  },
  {
    icon: GripIcon,
    label: "Move cards",
    description:
      "Drag a card header or selected group to move it. Arrow keys move selected Particles; Shift moves farther. Locked Particles stay fixed.",
  },
  {
    icon: MousePointer2Icon,
    label: "Select a group",
    description:
      "Drag empty space to select a group. Shift-click (or Command/Control-click) adds or removes an item. On touch-capable devices, use Shift-drag with a keyboard. Escape clears selection.",
  },
  {
    icon: ZoomInIcon,
    label: "Zoom",
    description: "Pinch to zoom, or hold Meta or Control while scrolling.",
  },
  {
    icon: PanelLeftOpenIcon,
    label: "Open tools",
    description:
      "Use the tool rail, or the cards drawer on smaller screens, to open and hide workspace cards.",
  },
]

export const WORKSPACE_CANVAS_HELP_TIP_STORAGE_KEY =
  "workspace-canvas-help-tip-dismissed"

export function resolveWorkspaceCanvasHelpTipInitialVisibility() {
  if (typeof window === "undefined") {
    return true
  }

  return (
    window.localStorage.getItem(WORKSPACE_CANVAS_HELP_TIP_STORAGE_KEY) !==
    "true"
  )
}

export function WorkspaceCanvasSurfaceV2HelpOverlay({
  integrated = false,
  particleActions,
}: {
  integrated?: boolean
  particleActions?: ReactNode
}) {
  const [tipVisible, setTipVisible] = useState(true)

  useEffect(() => {
    setTipVisible(resolveWorkspaceCanvasHelpTipInitialVisibility())
  }, [])

  const dismissTip = useCallback(() => {
    setTipVisible(false)
    if (typeof window === "undefined") return
    window.localStorage.setItem(WORKSPACE_CANVAS_HELP_TIP_STORAGE_KEY, "true")
  }, [])

  const handleHelpOpenChange = (open: boolean) => {
    if (open) {
      dismissTip()
    }
  }

  return (
    <div
      className={
        integrated
          ? "pointer-events-none relative"
          : "pointer-events-none absolute top-3 right-3 z-20"
      }
    >
      <div className="relative flex items-center justify-end">
        {tipVisible ? (
          <div
            className={
              integrated
                ? "pointer-events-auto absolute top-full right-0 mt-2"
                : "pointer-events-auto absolute top-1/2 right-full mr-2 -translate-y-1/2"
            }
          >
            <div className="bg-primary text-primary-foreground relative flex items-center gap-2 rounded-md px-3 py-1.5 text-xs leading-tight shadow-md">
              <span className="min-w-0 flex-1 whitespace-nowrap">
                Canvas help and Particles
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close canvas help tooltip"
                className="focus-visible:ring-primary-foreground/70 relative ml-auto size-6 shrink-0 rounded-sm p-0 opacity-80 shadow-none after:absolute after:-inset-2.5 hover:bg-transparent hover:text-current hover:opacity-100 focus-visible:ring-2"
                onClick={dismissTip}
              >
                <XIcon className="size-3" aria-hidden />
              </Button>
              <span
                aria-hidden
                className={
                  integrated
                    ? "bg-primary absolute -top-1 right-4 size-2 rotate-45 rounded-[2px]"
                    : "bg-primary absolute top-1/2 -right-1 size-2 -translate-y-1/2 rotate-45 rounded-[2px]"
                }
              />
            </div>
          </div>
        ) : null}

        <Popover onOpenChange={handleHelpOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Workspace canvas help"
              {...getReactGrabOwnerProps({
                ownerId: "workspace-canvas:help",
                component: "WorkspaceCanvasSurfaceV2HelpOverlay",
                source:
                  "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-help-overlay.tsx",
                slot: "trigger",
                tokenSource: "src/app/globals.css",
              })}
              className={
                integrated
                  ? "pointer-events-auto relative h-8 w-11 touch-manipulation rounded-lg after:absolute after:inset-x-0 after:-inset-y-1.5 md:w-8 md:after:hidden"
                  : "pointer-events-auto size-11 touch-manipulation rounded-xl md:size-9"
              }
              onClick={dismissTip}
            >
              <InfoIcon className="h-4 w-4" aria-hidden />
            </Button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={10}
            collisionPadding={16}
            className="pointer-events-auto max-h-[var(--radix-popover-content-available-height)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl p-0 motion-reduce:animate-none"
            {...getReactGrabLinkedSurfaceProps({
              ownerId: "workspace-canvas:help",
              component: "WorkspaceCanvasHelpContent",
              source:
                "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-help-overlay.tsx",
              surfaceKind: "content",
              tokenSource: "src/app/globals.css",
              primitiveImport: "@/components/ui/popover",
            })}
          >
            <div className="flex flex-col">
              {particleActions}
              <div className="border-border/60 flex flex-col gap-1 border-b px-4 py-3">
                <p className="text-foreground text-sm font-semibold">
                  Canvas help
                </p>
                <p className="text-muted-foreground text-xs leading-5">
                  Quick controls for moving around, selecting groups, and
                  opening tools.
                </p>
              </div>

              <div className="flex flex-col gap-1 p-2">
                {WORKSPACE_CANVAS_HELP_ITEMS.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-3 rounded-xl px-2 py-2"
                  >
                    <span className="border-border/60 bg-muted/40 text-muted-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-lg border">
                      <item.icon aria-hidden />
                    </span>

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="text-foreground text-sm font-medium">
                        {item.label}
                      </p>
                      <p className="text-muted-foreground text-xs leading-5">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
