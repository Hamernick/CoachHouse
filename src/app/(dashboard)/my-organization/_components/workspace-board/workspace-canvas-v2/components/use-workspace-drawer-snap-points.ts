"use client"

import { useLayoutEffect, useState } from "react"

import {
  resolveWorkspaceDataDrawerDisplaySnapPoint,
  WORKSPACE_DATA_DRAWER_SNAP_POINTS,
} from "./workspace-canvas-overlay-drawer-state"

export function useWorkspaceDrawerSnapPoints(
  container: HTMLElement | null,
  mobileParticles = false
) {
  const [snapPoints, setSnapPoints] = useState<(number | string)[]>(() => [
    ...WORKSPACE_DATA_DRAWER_SNAP_POINTS,
  ])

  useLayoutEffect(() => {
    if (!container) return
    let measuredHeight: number | null = null
    const measure = () => {
      const height = container.getBoundingClientRect().height
      if (height === measuredHeight) return
      measuredHeight = height
      // Vaul measures its container when snapPoints changes, but observes only
      // window resize. The canvas can settle or resize independently of it.
      setSnapPoints(
        WORKSPACE_DATA_DRAWER_SNAP_POINTS.map(
          (point) =>
            resolveWorkspaceDataDrawerDisplaySnapPoint(point, mobileParticles)!
        )
      )
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [container, mobileParticles])

  return snapPoints
}
