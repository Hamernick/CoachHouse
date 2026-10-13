import type { Edge, Node } from "@xyflow/react"

export function mergeUniqueWorkspaceCanvasNodes<TNode extends Node>(
  ...groups: TNode[][]
) {
  const nodeIds = new Set<string>()
  const nodes: TNode[] = []
  for (const node of groups.flat()) {
    if (nodeIds.has(node.id)) continue
    nodeIds.add(node.id)
    nodes.push(node)
  }
  return nodes
}

export function mergeUniqueWorkspaceCanvasEdges(...groups: Edge[][]) {
  const edgeIds = new Set<string>()
  const endpointPairs = new Set<string>()
  const edges: Edge[] = []
  for (const edge of groups.flat()) {
    const endpointPair = `${edge.source}:${edge.target}`
    if (edgeIds.has(edge.id) || endpointPairs.has(endpointPair)) continue
    edgeIds.add(edge.id)
    endpointPairs.add(endpointPair)
    edges.push(edge)
  }
  return edges
}
