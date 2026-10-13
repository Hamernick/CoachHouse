import type { NodeChange } from "@xyflow/react"

export function shouldReconcileWorkspaceCanvasNodes(changes: NodeChange[]) {
  return !changes.some(
    (change) => change.type === "position" && change.dragging === true
  )
}
