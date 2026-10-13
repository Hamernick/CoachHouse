"use client"

import { useEffect, type MutableRefObject } from "react"
import { getNodesBounds, getViewportForBounds, type Node, type ReactFlowInstance } from "@xyflow/react"
import {
  resolveWorkspaceCanvasCameraDuration,
  resolveWorkspaceCanvasFocusViewportSize,
  type WorkspaceCanvasFocusViewportSize,
} from "../runtime/workspace-canvas-viewport-command"
import { WORKSPACE_CANVAS_PERSON_NODE_SIZE } from "./workspace-canvas-person-node-model"

export function focusWorkspaceCanvasPeople(
  flowInstance: ReactFlowInstance,
  nodes: Node[],
  viewportSize: WorkspaceCanvasFocusViewportSize | null
) {
  const measuredNodes = nodes.map((node) => ({
    ...node,
    width: node.width ?? WORKSPACE_CANVAS_PERSON_NODE_SIZE.width,
    height: node.height ?? WORKSPACE_CANVAS_PERSON_NODE_SIZE.height,
  }))
  const duration = resolveWorkspaceCanvasCameraDuration(260)
  if (viewportSize) {
    const viewport = getViewportForBounds(
      getNodesBounds(measuredNodes), viewportSize.width, viewportSize.height, 0.24, 0.78, 0.22
    )
    void flowInstance.setViewport(viewport, { duration })
  } else {
    void flowInstance.fitView({ nodes, padding: 0.22, minZoom: 0.24, maxZoom: 0.78, duration })
  }
}

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

    let frame = 0
    let attempts = 0
    const focusWhenReady = () => {
      const nodeIdSet = new Set(fitRequest.nodeIds)
      const nodesToFit = flowInstance
        .getNodes()
        .filter((node) => nodeIdSet.has(node.id))
      if (nodesToFit.length !== nodeIdSet.size) {
        if (++attempts < 120) frame = window.requestAnimationFrame(focusWhenReady)
        return
      }
      const frameRect = document.querySelector<HTMLElement>(
        '[data-workspace-canvas-flow-frame="true"]'
      )?.getBoundingClientRect()
      focusWorkspaceCanvasPeople(
        flowInstance,
        nodesToFit,
        resolveWorkspaceCanvasFocusViewportSize() ?? (frameRect
          ? { width: frameRect.width, height: frameRect.height }
          : null)
      )
      onFitRequestHandled()
    }
    frame = window.requestAnimationFrame(focusWhenReady)

    return () => window.cancelAnimationFrame(frame)
  }, [
    fitRequest,
    flowInstanceRef,
    isFlowReady,
    onFitRequestHandled,
    renderNodes,
  ])
}
