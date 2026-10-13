"use client"

import { nativeWorkspaceDragEvent } from "@/lib/workspace-canvas/drag-events"
import type { WorkspaceSelectionDragHandler } from "@/lib/workspace-canvas/drag-events"
import { useCallback } from "react"
import type { Node, OnNodeDrag } from "@xyflow/react"

export function useWorkspaceCanvasSurfaceDragHandlers({
  handleNodeDragStop,
  handleWorkspacePersonNodeDragStop,
  handleWorkspacePersonNodesDragStop,
}: {
  handleNodeDragStop: OnNodeDrag
  handleWorkspacePersonNodeDragStop: (node: Node) => boolean
  handleWorkspacePersonNodesDragStop: (nodes: Node[]) => boolean | void
}) {
  const handleCanvasNodeDragStop = useCallback<OnNodeDrag>(
    (event, node, nodes) => {
      if (handleWorkspacePersonNodeDragStop(node)) {
        return
      }

      handleNodeDragStop(event, node, nodes)
    },
    [handleNodeDragStop, handleWorkspacePersonNodeDragStop]
  )
  const handleCanvasSelectionDragStop = useCallback<WorkspaceSelectionDragHandler>(
    (event, nodes) => {
      const draggedNodes = nodes
      handleWorkspacePersonNodesDragStop(draggedNodes)

      for (const draggedNode of draggedNodes) {
        if (draggedNode.type === "workspace-person") continue
        handleNodeDragStop(nativeWorkspaceDragEvent(event), draggedNode, draggedNodes)
      }
    },
    [handleNodeDragStop, handleWorkspacePersonNodesDragStop]
  )

  return {
    handleCanvasNodeDragStop,
    handleCanvasSelectionDragStop,
  }
}
