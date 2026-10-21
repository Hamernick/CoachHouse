"use client"

import { getReactGrabInspectionProps } from "@/components/dev/react-grab-surface"

import { useId, useState, type ReactNode } from "react"
import { WorkspaceWindowHeaderProvider } from "@/components/workspace/workspace-window-header-slots"
import { LayoutGroup, motion } from "motion/react"
import { useWorkspaceContentWindowMotion } from "./use-workspace-content-window-motion"
import { WORKSPACE_WINDOW_MOTION } from "./workspace-content-window-motion"
import { WorkspaceWindowControls } from "./workspace-window-controls"
import { WorkspaceEditorStatusProvider } from "@/components/workspace/workspace-editor-status"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { cn } from "@/lib/utils"
import type { WorkspaceContentWindowGeometry } from "./workspace-content-window-geometry"
import styles from "./workspace-dock.module.css"

export type WorkspaceContentWindowState = {
  geometry: WorkspaceContentWindowGeometry | null
  presentation?: "window" | "sidebar"
  maximized: boolean
  getAnchorRect?: () => DOMRect | null
  onClose: () => void
  onMinimize: () => void
  onToggleMaximize: () => void
}

// This wrapper never changes parent or portal when presentation changes.
function WorkspaceContentWindowSurface({
  children,
  windowState,
  collapsed,
  title,
  headerActions,
  headerSlots = false,
  maxWidth,
}: {
  children?: ReactNode | ((present: boolean) => ReactNode)
  windowState?: WorkspaceContentWindowState
  collapsed: boolean
  title: string
  headerSlots?: boolean
  headerActions?: ReactNode
  maxWidth?: number
}) {
  const titleId = useId()
  const [actionsTarget, setActionsTarget] = useState<HTMLDivElement | null>(
    null
  )
  const [accessoryTarget, setAccessoryTarget] = useState<HTMLDivElement | null>(
    null
  )
  const [titleTarget, setTitleTarget] = useState<HTMLDivElement | null>(null)
  const availableGeometry = windowState?.geometry
  const geometry =
    availableGeometry &&
    !windowState?.maximized &&
    maxWidth &&
    Number.isFinite(maxWidth) &&
    maxWidth > 0
      ? {
          ...availableGeometry,
          width: Math.min(availableGeometry.width, maxWidth),
        }
      : availableGeometry
  const desktop = Boolean(geometry)
  const {
    controls,
    surfaceRef,
    present,
    paintedGeometry,
    reducedMotion,
    willChange,
    onLayoutAnimationStart,
    onLayoutAnimationComplete,
  } = useWorkspaceContentWindowMotion({
    geometry,
    collapsed,
    getAnchorRect: windowState?.getAnchorRect,
    sidebar: windowState?.presentation === "sidebar",
  })
  const layoutEnabled = desktop && !reducedMotion && present && !collapsed
  return (
    <WorkspaceWindowHeaderProvider
      enabled={headerSlots}
      actions={actionsTarget}
      accessory={accessoryTarget}
      title={titleTarget}
    >
      <motion.section
        ref={surfaceRef}
        initial={false}
        animate={controls}
        layout={layoutEnabled}
        transition={{ layout: WORKSPACE_WINDOW_MOTION.spring }}
        onLayoutAnimationStart={onLayoutAnimationStart}
        onLayoutAnimationComplete={onLayoutAnimationComplete}
        {...getReactGrabInspectionProps("granular")}
        {...getReactGrabOwnerProps({
          ownerId: "workspace-canvas:content-window",
          component: "WorkspaceContentWindow",
          source:
            "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-content-window.tsx",
          tokenSource:
            "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-dock.module.css",
        })}
        aria-labelledby={
          desktop || headerActions || headerSlots ? titleId : undefined
        }
        aria-hidden={collapsed}
        inert={collapsed ? true : undefined}
        hidden={desktop && !present}
        data-workspace-content-window={desktop ? "true" : undefined}
        data-workspace-presentation={windowState?.presentation ?? "window"}
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          styles.contentSurface,
          desktop && styles.contentWindow,
          desktop && windowState?.presentation === "sidebar" && styles.organizationSidebar,
          desktop && !present && "hidden"
        )}
        style={
          paintedGeometry
            ? {
                willChange,
                width: paintedGeometry.width,
                height: paintedGeometry.height,
                borderRadius: 20,
                pointerEvents: collapsed ? "none" : "auto",
              }
            : undefined
        }
      >
        <motion.header
          layout={layoutEnabled ? "position" : false}
          hidden={!desktop && !headerActions && !headerSlots}
          className={cn(
            styles.windowHeader,
            headerSlots && styles.windowHeaderWithTools,
            !desktop && !headerActions && !headerSlots && "hidden"
          )}
        >
          {desktop && <WorkspaceWindowControls windowState={windowState} />}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <div id={titleId} className={styles.windowTitleCopy}>
              <h2 className="min-w-0 truncate text-sm font-medium">{title}</h2>
              <div ref={setTitleTarget} className={styles.windowTitleSlot} />
            </div>
            <div ref={setAccessoryTarget} className="min-w-0 empty:hidden has-[[data-workspace-people-header-segments]]:flex-1" />
          </div>
          <div ref={setActionsTarget} className={styles.windowHeaderActions} />
          {headerActions && (
            <div className="ml-auto shrink-0">{headerActions}</div>
          )}
        </motion.header>
        <motion.div
          layout={layoutEnabled ? "position" : false}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {typeof children === "function" ? children(present) : children}
        </motion.div>
      </motion.section>
    </WorkspaceWindowHeaderProvider>
  )
}

export function WorkspaceContentWindow(
  props: Parameters<typeof WorkspaceContentWindowSurface>[0]
) {
  return (
    <WorkspaceEditorStatusProvider>
      <LayoutGroup>
        <WorkspaceContentWindowSurface {...props} />
      </LayoutGroup>
    </WorkspaceEditorStatusProvider>
  )
}
