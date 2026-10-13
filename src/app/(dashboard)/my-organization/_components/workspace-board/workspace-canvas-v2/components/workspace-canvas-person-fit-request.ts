"use client"

import { useEffect, type MutableRefObject } from "react"
import type { Node, ReactFlowInstance } from "@xyflow/react"

export type WorkspaceCanvasPersonFitRequest = {
  nodeIds: string[]
  requestKey: number
} | null

export function useWorkspaceCanvasPersonFitRequest({
  flowInstanceRef,
  isFlowReady,
  renderNodes,
  fitRequest,
  onFitRequestHandled,
}: {
  flowInstanceRef: MutableRefObject<ReactFlowInstance | null>
  isFlowReady: boolean
  renderNodes: Node[]
  fitRequest: WorkspaceCanvasPersonFitRequest
  onFitRequestHandled: () => void
}) {
  useEffect(() => {
    if (!fitRequest || !isFlowReady) return
    const flowInstance = flowInstanceRef.current
    if (!flowInstance) return

    const frame = window.requestAnimationFrame(() => {
      const nodeIdSet = new Set(fitRequest.nodeIds)
      const nodesToFit = flowInstance
        .getNodes()
        .filter((node) => nodeIdSet.has(node.id))
      if (nodesToFit.length === 0) return

      void flowInstance.fitView({
        nodes: nodesToFit,
        padding: 0.22,
        minZoom: 0.24,
        maxZoom: 0.78,
        duration: 260,
      })
      onFitRequestHandled()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [
    fitRequest,
    flowInstanceRef,
    isFlowReady,
    onFitRequestHandled,
    renderNodes,
  ])
}
