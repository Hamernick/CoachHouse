"use client"
import { useCallback, useLayoutEffect, useRef } from "react"
import {
  WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT,
  WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT,
} from "./workspace-canvas-overlay-drawer-state"

export function useWorkspaceParticleDrawerRequest(
  id: string | null | undefined,
  key: number | undefined,
  onSnap: (value: number | string | null) => void
) {
  const retainOnClear = useRef(false)
  const previous = useRef<string | null>(null)
  useLayoutEffect(() => {
    const selection = `${id ?? ""}:${key ?? 0}`
    if (selection === previous.current) return
    previous.current = selection
    if (!key) return
    if (!id && retainOnClear.current) {
      retainOnClear.current = false
      return
    }
    retainOnClear.current = false
    onSnap(
      id
        ? WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
        : WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT
    )
  }, [id, key, onSnap])
  return useCallback(() => {
    retainOnClear.current = true
  }, [])
}
