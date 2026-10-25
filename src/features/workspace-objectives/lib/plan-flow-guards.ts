import type { ReactFlowProps } from "@xyflow/react"
import { isObjectivePlanNode } from "./plan-projection"
type Handlers = Pick<ReactFlowProps, "onNodesChange" | "onNodeClick" | "onNodeDoubleClick" | "onEdgeDoubleClick" | "onEdgeContextMenu" | "onConnect" | "isValidConnection">
export function guardObjectivePlanInteractions(handlers: Handlers): Handlers {
  return {
    onNodesChange: changes => {
      const ordinary = changes.filter(change => !isObjectivePlanNode(change.type === "add" || change.type === "replace" ? change.item.id : change.id))
      if (ordinary.length) handlers.onNodesChange?.(ordinary)
    },
    onNodeClick: (event, node) => { if (!isObjectivePlanNode(node.id)) handlers.onNodeClick?.(event, node) },
    onNodeDoubleClick: (event, node) => { if (!isObjectivePlanNode(node.id)) handlers.onNodeDoubleClick?.(event, node) },
    onEdgeDoubleClick: (event, edge) => { if (!isObjectivePlanNode(edge.id)) handlers.onEdgeDoubleClick?.(event, edge) },
    onEdgeContextMenu: (event, edge) => { if (!isObjectivePlanNode(edge.id)) handlers.onEdgeContextMenu?.(event, edge) },
    onConnect: connection => { if (!isObjectivePlanNode(connection.source) && !isObjectivePlanNode(connection.target)) handlers.onConnect?.(connection) },
    isValidConnection: connection => !isObjectivePlanNode(connection.source) && !isObjectivePlanNode(connection.target) && (handlers.isValidConnection?.(connection) ?? true),
  }
}
