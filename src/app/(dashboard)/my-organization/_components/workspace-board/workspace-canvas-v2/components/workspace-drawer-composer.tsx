"use client"

import { useRef, type ReactNode, type Ref, type SetStateAction } from "react"
import {
  WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT,
  WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT,
} from "./workspace-canvas-overlay-drawer-state"

export function WorkspaceDrawerComposer({
  children,
  desktop = false,
  composerRef,
  activeSnapPoint,
  onSnapChange,
}: {
  desktop?: boolean
  children: ReactNode
  composerRef: Ref<HTMLDivElement>
  activeSnapPoint: number | string | null
  onSnapChange: (value: SetStateAction<number | string | null>) => void
}) {
  const priorSnap = useRef<number | string | null>(null)
  return (
    <div
      ref={composerRef}
      className="shrink-0"
      onFocusCapture={(event) => {
        if (desktop) return
        if (!(event.target instanceof HTMLTextAreaElement)) return
        if (!event.currentTarget.contains(event.relatedTarget))
          priorSnap.current = activeSnapPoint
        onSnapChange(WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT)
      }}
      onKeyDown={(event) => {
        if (
          event.key !== "Escape" ||
          !(event.target instanceof HTMLTextAreaElement)
        )
          return
        if (desktop) return
        event.stopPropagation()
        event.target.blur()
        onSnapChange(
          priorSnap.current ?? WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT
        )
      }}
    >
      {children}
    </div>
  )
}
