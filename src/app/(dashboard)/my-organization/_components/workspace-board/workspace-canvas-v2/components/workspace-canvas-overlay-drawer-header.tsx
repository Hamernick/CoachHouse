"use client"
import { WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT } from "./workspace-canvas-overlay-drawer-state"
import { cn } from "@/lib/utils"
import {
  DrawerTitle,
  DrawerHandle,
  DrawerDescription,
} from "@/components/ui/drawer"

export function WorkspaceDrawerHeader({
  compact,
  desktop = false,
  onCollapse,
}: {
  desktop?: boolean
  compact: boolean
  onCollapse: (snapPoint: string) => void
}) {
  return (
    <>
      <div
        data-workspace-dock-header={!compact ? "true" : undefined}
        className={cn(
          "relative grid shrink-0 grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)] items-center px-3",
          compact ? "h-8" : "h-6"
        )}
        onDoubleClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onCollapse(WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT)
        }}
      >
        <DrawerTitle className="sr-only">Workspace drawer</DrawerTitle>
        {desktop ? (
          <div
            aria-hidden
            className="bg-foreground/18 col-start-2 h-1 w-9 justify-self-center rounded-full"
          />
        ) : (
          <DrawerHandle
            preventCycle
            aria-label="Resize workspace panel"
            className={cn(
              "bg-foreground/18 col-start-2 mt-0 block !h-[3px] !w-32 justify-self-center rounded-full",
              !compact && "!h-1 !w-9"
            )}
          />
        )}
      </div>
      <DrawerDescription className="sr-only">
        Switch between your organization profile, people, documents, Finance,
        and Accelerator.
      </DrawerDescription>
    </>
  )
}
