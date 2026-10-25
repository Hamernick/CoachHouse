"use client"
import { useCallback, type MouseEvent, type SetStateAction } from "react"
import {
  isWorkspaceDataDrawerCollapsedSnapPoint as isDrawerCollapsed,
  WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT,
  WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT,
  WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT,
} from "./workspace-canvas-overlay-drawer-state"

export function useWorkspaceDrawerControls({
  setOpen,
  handleActiveSnapPointChange,
  particleComposer,
  drawerCollapsed,
  drawerFullscreen,
}: {
  setOpen: (open: boolean) => void
  handleActiveSnapPointChange: (
    snap: SetStateAction<number | string | null>
  ) => void
  particleComposer: boolean
  drawerCollapsed: boolean
  drawerFullscreen: boolean
}) {
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setOpen(true)
        handleActiveSnapPointChange(
          (current) => current ?? WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
        )
        return
      }

      setOpen(true)
      handleActiveSnapPointChange(WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT)
    },
    [handleActiveSnapPointChange, setOpen]
  )

  const handleDataShortcutClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      setOpen(true)
      handleActiveSnapPointChange((current) =>
        !isDrawerCollapsed(current)
          ? WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT
          : WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
      )
    },
    [handleActiveSnapPointChange, setOpen]
  )

  const handleDataDrawerFullscreenChange = useCallback(
    (pressed: boolean) => {
      setOpen(true)
      handleActiveSnapPointChange(
        particleComposer
          ? drawerCollapsed
            ? WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
            : drawerFullscreen
              ? WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT
              : WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT
          : pressed
            ? WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT
            : WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
      )
    },
    [
      handleActiveSnapPointChange,
      setOpen,
      particleComposer,
      drawerCollapsed,
      drawerFullscreen,
    ]
  )
  return {
    handleOpenChange,
    handleDataShortcutClick,
    handleDataDrawerFullscreenChange,
  }
}
