import type { ParticleGraph } from "../types"
import { workspaceToolLabel } from "./workspace-tool-contract"
import { PARTICLE_RELATIONSHIP_LABELS } from "./connection-editing"

export function particleConnectionMenuItems(graph: ParticleGraph, id: string) {
  const clicked = graph.connections.find((edge) => edge.id === id)
  if (!clicked) return []
  const names = new Map(graph.particles.map((item) => [item.id, item.title]))
  const name = (id: string) =>
    names.get(id) ?? workspaceToolLabel(id) ?? "Particle"
  return graph.connections
    .filter((edge) =>
      [clicked.source, clicked.target].some(
        (id) => edge.source === id || edge.target === id
      )
    )
    .sort((a, b) => Number(b.id === id) - Number(a.id === id))
    .map((edge) => {
      const source = graph.particles.find((item) => item.id === edge.source)
      const outcome =
        source?.type === "decision"
          ? source.data.outcomes.find((item) => item.id === edge.outcome)?.label
          : undefined
      return {
        id: edge.id,
        revision: edge.revision,
        label: `${name(edge.source)} → ${name(edge.target)}`,
        detail: outcome ?? PARTICLE_RELATIONSHIP_LABELS[edge.relationship],
        clicked: edge.id === id,
      }
    })
}
