"use client"

import { type RefObject, useLayoutEffect } from "react"
import { useUpdateNodeInternals } from "@xyflow/react"

export function useWorkspaceNodeInternalsSync(
  nodeId: string,
  elementRef: RefObject<HTMLElement | null>,
) {
  const updateNodeInternals = useUpdateNodeInternals()

  useLayoutEffect(() => {
    const element = elementRef.current
    if (!element) return

    let frameId = 0
    const syncNodeInternals = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        updateNodeInternals(nodeId)
      })
    }

    syncNodeInternals()

    const observer = new ResizeObserver(() => {
      syncNodeInternals()
    })
    observer.observe(element)

    return () => {
      cancelAnimationFrame(frameId)
      observer.disconnect()
    }
  }, [elementRef, nodeId, updateNodeInternals])
}
