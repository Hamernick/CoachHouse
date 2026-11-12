"use client"

import { useCallback, useLayoutEffect, useState, type RefObject, type SetStateAction } from "react"
import type { WorkspaceCanvasDrawerTab } from "./workspace-canvas-overlay-drawer-tabs"
import { resolveWorkspaceContentWindowGeometry } from "./workspace-content-window-geometry"
import {
  isWorkspaceDataDrawerFullscreenSnapPoint,
  WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT,
  WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT,
  WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT,
} from "./workspace-canvas-overlay-drawer-state"

export function useWorkspaceContentWindow({
  enabled,
  tab,
  canvasWidth,
  canvasHeight,
  dockHeight,
  activeSnapPoint,
  onSnap,
  leaveParticle,
  tabsListRef,
}: {
  enabled: boolean
  tab?: WorkspaceCanvasDrawerTab
  canvasWidth: number
  canvasHeight: number
  dockHeight: number
  activeSnapPoint: number | string | null
  onSnap: (snap: SetStateAction<number | string | null>) => void
  leaveParticle: (onAccepted?: () => void) => boolean
  tabsListRef: RefObject<HTMLDivElement | null>
}) {
  const [topInset, setTopInset] = useState(8)
  useLayoutEffect(() => {
    if (!enabled) return
    const navigation = tabsListRef.current?.closest<HTMLElement>("[data-workspace-top-navigation]")
    const surface = navigation?.closest<HTMLElement>(".workspace-layout-surface")
    if (!navigation || !surface) return
    const measure = () => {
      const bounds = navigation.getBoundingClientRect()
      // Keep the last visible measurement while fullscreen hides navigation.
      if (!bounds.height) return
      const bottom = bounds.bottom - surface.getBoundingClientRect().top
      setTopInset(Math.max(8, Math.ceil(bottom) + 8))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(navigation)
    observer.observe(surface)
    return () => observer.disconnect()
  }, [enabled, canvasWidth, canvasHeight, activeSnapPoint, tabsListRef])
  const maximized = isWorkspaceDataDrawerFullscreenSnapPoint(activeSnapPoint)
  const geometry = enabled
    ? resolveWorkspaceContentWindowGeometry({
        canvasWidth,
        canvasHeight,
        dockHeight,
        topInset,
        maximized,
        tab,
      })
    : null
  const getAnchorRect = useCallback(() => {
    const list = tabsListRef.current
    const anchor =
      list?.querySelector<HTMLElement>('[role="tab"][data-state="active"]') ??
      list?.parentElement?.querySelector<HTMLElement>(
        "[data-workspace-data-drawer-fullscreen-trigger]"
      )
    const organization = document.querySelector<HTMLElement>(
      '[data-workspace-organization-trigger][data-state="active"]'
    )
    return (anchor ?? organization)?.getBoundingClientRect() ?? null
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
      const organization = document.querySelector<HTMLButtonElement>(
        '[data-workspace-organization-trigger][data-state="active"]'
      )
      const returnTarget = target ?? organization ?? document.querySelector<HTMLButtonElement>(
        '[data-workspace-composer-action][aria-label="Add Particle"]'
      ) ?? Array.from(
        document.querySelectorAll<HTMLButtonElement>('[data-sidebar="trigger"]')
      ).find((button) => button.getBoundingClientRect().width > 0)
      returnTarget?.focus({ preventScroll: true })
    })
  }
  return {
    geometry,
    topInset,
    resolvePreferredGeometry: (preferredWidth: number) => enabled
      ? resolveWorkspaceContentWindowGeometry({ canvasWidth, canvasHeight, dockHeight, topInset, maximized, tab, preferredWidth })
      : null,
    presentation: tab === "organization" ? "sidebar" as const : "window" as const,
    getAnchorRect,
    maximized,
    onMinimize,
    onClose: () => {
      if (leaveParticle(onMinimize)) onMinimize()
    },
    onToggleMaximize: () =>
      onSnap(
        maximized
          ? WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
          : WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT
      ),
  }
}
