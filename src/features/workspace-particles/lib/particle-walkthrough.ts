import type { ParticleGraph } from "../types"
import { particlePlanBranchLabel, particlePlanBranchStates } from "./particle-plan-branches"

export type ParticleWalkthroughReference = {
  workspaceId: string
  objectiveId: string
  planId: string
  proposalId?: string
}

/** Read current authorized membership, never a cached copy of plan content. */
export function readParticleWalkthrough(graph: ParticleGraph | null, reference: ParticleWalkthroughReference) {
  if (!graph || graph.workspaceId !== reference.workspaceId) return null
  const objective = graph.particles.find(item => item.id === reference.objectiveId)
  if (objective?.type !== "objective" || objective.workspaceId !== graph.workspaceId) return null
  const planning = objective.data.planning
  const plan = reference.proposalId
    ? planning?.proposals.find(item => item.id === reference.proposalId && item.planId === reference.planId && item.status === "pending")
    : planning?.plans.find(item => item.id === reference.planId)
  if (!plan) return null
  const members = new Set(plan.particleIds)
  const links = plan.links ?? []
  // Corrupt/stale references cannot turn into a guessed route. Kahn's traversal
  // is bounded by the existing 250-member/60-link schema; membership breaks ties.
  if (links.some(link => !members.has(link.source) || !members.has(link.target))) return null
  const remaining = new Set(members)
  const ids: string[] = []
  while (remaining.size) {
    const next = plan.particleIds.find(id => remaining.has(id) && !links.some(link => link.target === id && remaining.has(link.source)))
    if (!next) return null
    ids.push(next)
    remaining.delete(next)
  }
  const available = graph.particles.filter(item => item.workspaceId === graph.workspaceId && !item.canvasHidden)
  const states = particlePlanBranchStates(plan, available)
  return {
    title: plan.title,
    proposed: Boolean(reference.proposalId),
    items: ids.map(id => {
      const particle = available.find(item => item.id === id)
      return {
        id,
        particle,
        branch: states.get(id),
        condition: particle ? particlePlanBranchLabel(plan, id, available) : "",
      }
    }),
  }
}
