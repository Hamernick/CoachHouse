import type { Node, OnNodeDrag, SelectionDragHandler } from "@xyflow/react"

// v12 sends native events for node drags and React events for selection drags.
export type WorkspaceDragEvent =
  | Parameters<OnNodeDrag>[0]
  | Parameters<SelectionDragHandler>[0]
export type WorkspaceSelectionDragHandler = (
  event: WorkspaceDragEvent,
  nodes: Node[]
) => void

export function nativeWorkspaceDragEvent(event: WorkspaceDragEvent) {
  return "nativeEvent" in event ? event.nativeEvent : event
}
