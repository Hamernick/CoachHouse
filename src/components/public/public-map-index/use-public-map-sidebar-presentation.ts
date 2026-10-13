"use client"

import { useEffect } from "react"

import type { PublicMapSidebarProps } from "./sidebar-contract"
import type { SidebarMode } from "./constants"
import { resolvePublicMapDrawerVisibleHeight } from "./sidebar-snap-points"

type PresentationProps = Pick<
  PublicMapSidebarProps,
  | "sidebarMode"
  | "setSidebarMode"
  | "panelPresentation"
  | "surfaceHeight"
  | "onDrawerInsetChange"
> & {
  compact: boolean
  panelOpen: boolean
  effectiveSidebarMode: SidebarMode
  setActiveSnapIndex: (index: 0 | 1 | 2) => void
  drawerIsFullscreen: boolean
  activeSnapPoint: number | string
}

export function usePublicMapSidebarPresentation({
  compact,
  sidebarMode,
  setSidebarMode,
  panelPresentation,
  panelOpen,
  effectiveSidebarMode,
  setActiveSnapIndex,
  drawerIsFullscreen,
  activeSnapPoint,
  surfaceHeight,
  onDrawerInsetChange,
}: PresentationProps) {
  useEffect(() => {
    if (compact && sidebarMode === "hidden") {
      setSidebarMode("search")
    }
  }, [compact, setSidebarMode, sidebarMode])
  useEffect(() => {
    if (panelPresentation !== "drawer") return
    if (!panelOpen) {
      setActiveSnapIndex(0)
      return
    }
    if (effectiveSidebarMode === "details") {
      setActiveSnapIndex(1)
    }
  }, [effectiveSidebarMode, panelOpen, panelPresentation, setActiveSnapIndex])
  useEffect(() => {
    const drawerInset =
      panelPresentation === "drawer" && panelOpen && !drawerIsFullscreen
        ? resolvePublicMapDrawerVisibleHeight({
            snapPoint: activeSnapPoint,
            surfaceHeight,
          })
        : 0

    onDrawerInsetChange?.(drawerInset)
  }, [
    activeSnapPoint,
    drawerIsFullscreen,
    onDrawerInsetChange,
    panelOpen,
    panelPresentation,
    surfaceHeight,
  ])
  useEffect(() => () => onDrawerInsetChange?.(0), [onDrawerInsetChange])
}
