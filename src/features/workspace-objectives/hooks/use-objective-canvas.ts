"use client"
import { useMemo, useState } from "react"
import type { Node } from "@xyflow/react"
import type { ObjectivePlanProjection } from "../components/objective-plan-node"
export { isObjectivePlanNode } from "../lib/plan-projection"
export function useObjectiveCanvas(scopeKey: string, enabled: boolean, existing: Node[]) {
  const [projection, setProjection] = useState<ObjectivePlanProjection | null>(null)
  const current = enabled && projection?.scopeKey === scopeKey ? projection : null
  const offset = Math.max(0, ...existing.filter(node => !node.hidden).map(node => node.position.x + (node.measured?.width ?? node.width ?? 320))) + 120
  const nodes = useMemo(() => (current?.nodes ?? []).map(node => ({ ...node, position: { x: node.position.x + offset, y: node.position.y } })), [current, offset])
  return { nodes, edges: current?.edges ?? [], focusKey: current?.focusKey ?? "", onProjection: setProjection }
}
