"use client"
import { useMemo, useState } from "react"
import type { Node } from "@xyflow/react"
import type { ObjectivePlanProjection } from "../components/objective-plan-node"
export { isObjectivePlanNode } from "../lib/plan-projection"
const EMPTY_NODES: ObjectivePlanProjection["nodes"] = []
const EMPTY_EDGES: ObjectivePlanProjection["edges"] = []
export function useObjectiveCanvas(scopeKey: string, enabled: boolean, existing: Node[]) {
  const [projection, setProjection] = useState<ObjectivePlanProjection | null>(null)
  const current = enabled && projection?.scopeKey === scopeKey ? projection : null
  const offset = current ? Math.max(0, ...existing.filter(node => !node.hidden).map(node => node.position.x + (node.measured?.width ?? node.width ?? 320))) + 120 : 0
  // Drag positions change every frame. An absent preview must not replace the
  // canvas edge array and notify every edge subscriber on each pointer move.
  const nodes = useMemo(() => current ? current.nodes.map(node => ({ ...node, position: { x: node.position.x + offset, y: node.position.y } })) : EMPTY_NODES, [current, offset])
  return { nodes, edges: current?.edges ?? EMPTY_EDGES, focusKey: current?.focusKey ?? "", onProjection: setProjection }
}
