"use client"

import { useId, type ReactNode } from "react"
import { motion } from "motion/react"
import { useWorkspaceContentWindowMotion } from "./use-workspace-content-window-motion"
import { WORKSPACE_WINDOW_MOTION } from "./workspace-content-window-motion"
import XIcon from "lucide-react/dist/esm/icons/x"
import MinusIcon from "lucide-react/dist/esm/icons/minus"
import Maximize2Icon from "lucide-react/dist/esm/icons/maximize-2"
import Minimize2Icon from "lucide-react/dist/esm/icons/minimize-2"
import { Button } from "@/components/ui/button"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { cn } from "@/lib/utils"
import type { WorkspaceContentWindowGeometry } from "./workspace-content-window-geometry"
import styles from "./workspace-dock.module.css"

export type WorkspaceContentWindowState = {
  geometry: WorkspaceContentWindowGeometry | null
  maximized: boolean
  getAnchorRect?: () => DOMRect | null
  onClose: () => void
  onMinimize: () => void
  onToggleMaximize: () => void
}

// This wrapper never changes parent or portal when presentation changes.
export function WorkspaceContentWindow({
  children,
  windowState,
  collapsed,
  title,
}: {
  children?: ReactNode | ((present: boolean) => ReactNode)
  windowState?: WorkspaceContentWindowState
  collapsed: boolean
  title: string
}) {
  const titleId = useId()
  const geometry = windowState?.geometry
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
  })
  const layoutEnabled = desktop && !reducedMotion && present && !collapsed
  return (
    <motion.section
      ref={surfaceRef}
      initial={false}
      animate={controls}
      layout={layoutEnabled}
      layoutDependency={`${geometry?.width}:${geometry?.height}`}
      transition={{ layout: WORKSPACE_WINDOW_MOTION.spring }}
      onLayoutAnimationStart={onLayoutAnimationStart}
      onLayoutAnimationComplete={onLayoutAnimationComplete}
      {...getReactGrabOwnerProps({
        ownerId: "workspace-canvas:content-window",
        component: "WorkspaceContentWindow",
        source:
          "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-content-window.tsx",
        tokenSource:
          "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-dock.module.css",
      })}
      aria-labelledby={desktop ? titleId : undefined}
      aria-hidden={collapsed}
      inert={collapsed ? true : undefined}
      hidden={desktop && !present}
      data-workspace-content-window={desktop ? "true" : undefined}
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        styles.contentSurface,
        desktop && styles.contentWindow,
        desktop && !present && "hidden"
      )}
      style={
        paintedGeometry
          ? {
              willChange,
              width: paintedGeometry.width,
              height: paintedGeometry.height,
              marginLeft: -paintedGeometry.width / 2,
              borderRadius: 24,
              pointerEvents: collapsed ? "none" : "auto",
            }
          : undefined
      }
    >
      <motion.header
        layout={layoutEnabled ? "position" : false}
        hidden={!desktop}
        className={cn(
          "border-border/70 flex shrink-0 items-center gap-3 border-b px-3 py-2",
          !desktop && "hidden"
        )}
      >
        <div
          className="flex shrink-0 items-center gap-1"
          role="group"
          aria-label="Window controls"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={styles.windowControl}
            aria-label="Close content window"
            title="Close"
            onClick={windowState?.onClose}
          >
            <XIcon aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={styles.windowControl}
            aria-label="Minimize content window"
            title="Minimize"
            onClick={windowState?.onMinimize}
          >
            <MinusIcon aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={styles.windowControl}
            aria-label={
              windowState?.maximized
                ? "Restore content window"
                : "Maximize content window"
            }
            title={windowState?.maximized ? "Restore" : "Maximize"}
            onClick={windowState?.onToggleMaximize}
          >
            {windowState?.maximized ? (
              <Minimize2Icon aria-hidden />
            ) : (
              <Maximize2Icon aria-hidden />
            )}
          </Button>
        </div>
        <h2 id={titleId} className="min-w-0 truncate text-sm font-medium">
          {title}
        </h2>
      </motion.header>
      <motion.div
        layout={layoutEnabled ? "position" : false}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {typeof children === "function" ? children(present) : children}
      </motion.div>
    </motion.section>
  )
}
