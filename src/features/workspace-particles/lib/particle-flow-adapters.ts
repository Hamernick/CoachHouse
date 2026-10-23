import { visibleParticleConnections } from "./particle-placement"
import type { Edge } from "@xyflow/react"
import type { ParticleLayout } from "./graph-layout"
import type { ParticleConnection, ParticleGraph } from "../types"

export function withPendingParticleConnection(
  graph: ParticleGraph,
  preview: ParticleConnection | null
) {
  return preview && !graph.connections.some((item) => item.id === preview.id)
    ? { ...graph, connections: [...graph.connections, preview] }
    : graph
}

export function particleConnectionsToFlow(
  graph: ParticleGraph,
  routes: ParticleLayout["routes"] = [],
  toolIds: readonly string[] = [],
  preview: ParticleConnection | null = null
): Edge[] {
  const visibleGraph = withPendingParticleConnection(graph, preview)
  const edges: Edge[] = visibleParticleConnections(visibleGraph, toolIds).map((connection) => {
    const source = graph.particles.find(
      (particle) => particle.id === connection.source
    )
    const outcome =
      source?.type === "decision"
        ? source.data.outcomes.find((item) => item.id === connection.outcome)
        : undefined
    const chosen =
      source?.type === "decision" && source.data.selectedOutcome !== null
    return {
      id: connection.id,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: "workspace-particle",
      data: {
        points: routes.find((route) => route.id === connection.id)?.points,
      },
      label: outcome?.label,
      interactionWidth: 28,
      selectable: false,
      deletable: false,
      style: {
        stroke: "var(--muted-foreground)",
        strokeWidth:
          chosen && source.data.selectedOutcome === connection.outcome
            ? 2.5
            : 2,
        opacity:
          chosen &&
          connection.relationship === "decision_outcome" &&
          source.data.selectedOutcome !== connection.outcome
            ? 0.35
            : 1,
      },
    }
  })
  // Membership is a projection, not a dependency or an editable graph edge.
  for (const objective of graph.particles) {
    if (objective.type !== "objective" || objective.canvasHidden) continue
    const members = new Set(objective.data.planning?.plans.flatMap(plan => plan.particleIds) ?? [])
    for (const id of members) {
      if (!graph.particles.some(item => item.id === id && !item.canvasHidden)) continue
      edges.push({ id: `plan-member:${objective.id}:${id}`, source: objective.id, target: id,
        sourceHandle: "out", targetHandle: "in", type: "smoothstep", selectable: false, deletable: false,
        ariaLabel: "Plan membership", style: { stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 5" },
      })
    }
  }
  return edges
}
