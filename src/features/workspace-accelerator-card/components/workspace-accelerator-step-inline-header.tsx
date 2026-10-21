"use client"

import type { ReactNode } from "react"
import WaypointsIcon from "lucide-react/dist/esm/icons/waypoints"
import { WORKSPACE_TEXT_STYLES } from "@/components/workspace/workspace-typography"
import { cn } from "@/lib/utils"

/** Standalone canvas/fullscreen lessons retain their original inline header. */
export function WorkspaceAcceleratorStepInlineHeader({
  embedded,
  inDrawer,
  stackSidebar,
  closeFocused,
  showModuleTitle,
  moduleTitle,
  stepTitle,
  isMobile,
  navigationControls,
  closeControl,
}: {
  embedded: boolean
  inDrawer: boolean
  stackSidebar: boolean
  closeFocused: boolean
  showModuleTitle: boolean
  moduleTitle: string
  stepTitle: string
  isMobile: boolean
  navigationControls: ReactNode
  closeControl: ReactNode
}) {
  return (
    <header
      className={cn(
        "@container/lesson-header shrink-0 px-3 py-3 sm:px-4",
        !stackSidebar && "border-border/60 border-b",
        !inDrawer && "bg-muted/20",
        closeFocused && "relative z-20 overflow-visible",
        !embedded &&
          "accelerator-step-node-drag-handle cursor-grab active:cursor-grabbing"
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1 gap-y-2 @min-[26rem]/lesson-header:grid-cols-[minmax(0,1fr)_auto_auto] @min-[26rem]/lesson-header:gap-x-3">
        <div className="col-span-2 min-w-0 @min-[26rem]/lesson-header:col-span-1">
          {showModuleTitle ? (
            <p className={cn("truncate", WORKSPACE_TEXT_STYLES.meta)}>
              {moduleTitle}
            </p>
          ) : null}
          <h3
            className={cn(
              "break-words",
              isMobile ? "line-clamp-2" : "line-clamp-1",
              WORKSPACE_TEXT_STYLES.cardTitle
            )}
          >
            <span className="flex items-start gap-1.5">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px]">
                <WaypointsIcon
                  className="h-3.5 w-3.5 text-fuchsia-500 dark:text-fuchsia-400"
                  aria-hidden
                />
              </span>
              {stepTitle}
            </span>
          </h3>
        </div>
        <div className="col-start-1 row-start-2 flex min-w-0 items-center gap-1 @min-[26rem]/lesson-header:col-start-2 @min-[26rem]/lesson-header:row-start-1">
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {navigationControls}
          </div>
        </div>
        <div className="col-start-2 row-start-2 justify-self-end @min-[26rem]/lesson-header:col-start-3 @min-[26rem]/lesson-header:row-start-1">
          {closeControl}
        </div>
      </div>
    </header>
  )
}
