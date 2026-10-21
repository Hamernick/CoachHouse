"use client"

import type { ComponentProps, ReactNode } from "react"
import { createPortal } from "react-dom"
import { Drawer, DrawerContent } from "@/components/ui/drawer"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import type { WorkspaceOverlayDrawerProps } from "./workspace-overlay-drawer-props"
import { WORKSPACE_DATA_DRAWER_SNAP_POINTS } from "./workspace-canvas-overlay-drawer-state"
import styles from "./workspace-dock.module.css"

// The Particle dock has one stable, canvas-local portal at every viewport size.
// Only workspaces without the Particle composer retain the legacy sheet.
export function WorkspaceDockHost({
  floating,
  container,
  children,
  onMinimize,
  request,
  legacyRootProps,
  legacyContentProps,
  legacyTrigger,
}: {
  floating: boolean
  container: HTMLElement | null
  children: ReactNode
  onMinimize: () => void
  request: WorkspaceOverlayDrawerProps["request"]
  legacyRootProps: ComponentProps<typeof Drawer>
  legacyContentProps: ComponentProps<typeof DrawerContent> & {
    "data-workspace-canvas-drawer-fullscreen"?: string
  }
  legacyTrigger: ReactNode
}) {
  if (!container) return null
  const requestProps = {
    "data-workspace-canvas-overlay-drawer": "true",
    "data-workspace-data-drawer-request-step": request?.acceleratorStepId,
    "data-workspace-data-drawer-request-module": request?.acceleratorModuleId,
    "data-workspace-data-drawer-request-roadmap-section":
      request?.roadmapSectionSlug,
  }
  if (floating)
    return createPortal(
      <section
        {...getReactGrabOwnerProps({
          ownerId: "workspace-canvas:dock-shell",
          component: "WorkspaceDockHost",
          source:
            "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-dock-host.tsx",
          tokenSource:
            "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-dock.module.css",
        })}
        {...requestProps}
        aria-label="Workspace dock"
        className={styles.dockHost}
        onKeyDown={(event) => {
          if (
            event.key !== "Escape" ||
            event.defaultPrevented ||
            !(event.target instanceof Node) ||
            !event.currentTarget.contains(event.target)
          )
            return
          event.preventDefault()
          onMinimize()
        }}
      >
        {children}
      </section>,
      container
    )
  return (
    <Drawer
      {...legacyRootProps}
      container={container}
      direction="bottom"
      disablePreventScroll
      dismissible={false}
      fadeFromIndex={2}
      handleOnly
      modal={false}
      noBodyStyles
      repositionInputs={false}
      snapPoints={[...WORKSPACE_DATA_DRAWER_SNAP_POINTS]}
      snapToSequentialPoint
      shouldScaleBackground={false}
    >
      {legacyTrigger}
      <DrawerContent
        {...legacyContentProps}
        {...requestProps}
        showHandle={false}
        overlayClassName="pointer-events-none absolute inset-0 !z-10 bg-background/10 backdrop-blur-[1px]"
      >
        {children}
      </DrawerContent>
    </Drawer>
  )
}
