"use client"

import { useCallback, type RefObject, type SetStateAction } from "react"
import { resolveWorkspaceContentWindowGeometry } from "./workspace-content-window-geometry"
import {
  isWorkspaceDataDrawerFullscreenSnapPoint,
  WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT,
  WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT,
  WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT,
} from "./workspace-canvas-overlay-drawer-state"

export function useWorkspaceContentWindow({
  enabled,
  canvasWidth,
  canvasHeight,
  dockHeight,
  activeSnapPoint,
  onSnap,
  leaveParticle,
  tabsListRef,
}: {
  enabled: boolean
  canvasWidth: number
  canvasHeight: number
  dockHeight: number
  activeSnapPoint: number | string | null
  onSnap: (snap: SetStateAction<number | string | null>) => void
  leaveParticle: () => boolean
  tabsListRef: RefObject<HTMLDivElement | null>
}) {
  const maximized = isWorkspaceDataDrawerFullscreenSnapPoint(activeSnapPoint)
  const geometry = enabled
    ? resolveWorkspaceContentWindowGeometry({
        canvasWidth,
        canvasHeight,
        dockHeight,
        maximized,
      })
    : null
  const getAnchorRect = useCallback(() => {
    const list = tabsListRef.current
    const anchor =
      list?.querySelector<HTMLElement>('[role="tab"][data-state="active"]') ??
      list?.parentElement?.querySelector<HTMLElement>(
        "[data-workspace-data-drawer-fullscreen-trigger]"
      )
    return anchor?.getBoundingClientRect() ?? null
  }, [tabsListRef])
  const onMinimize = () => {
    onSnap(WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT)
    // The accepted destination owns return focus; never focus hidden content.
    requestAnimationFrame(() => {
      const list = tabsListRef.current
      const target =
        list?.querySelector<HTMLButtonElement>(
          '[role="tab"][data-state="active"]'
        ) ??
        list?.parentElement?.querySelector<HTMLButtonElement>(
          "[data-workspace-data-drawer-fullscreen-trigger]"
        )
      target?.focus({ preventScroll: true })
    })
  }
  return {
    geometry,
    getAnchorRect,
    maximized,
    onMinimize,
    onClose: () => {
      if (leaveParticle()) onMinimize()
    },
    onToggleMaximize: () =>
      onSnap(
        maximized
          ? WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
          : WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT
      ),
  }
}
