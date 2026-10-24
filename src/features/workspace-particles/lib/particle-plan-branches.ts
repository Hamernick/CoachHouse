import type { Particle, ParticleGraph } from "../types"
import type { ParticlePlan } from "./particle-plan-schema"

export type PlanBranchState = "active" | "waiting" | "inactive"
type Plan = Pick<ParticlePlan, "particleIds" | "links">

/** Reachability, not task completion. Converging alternatives use OR semantics. */
export function particlePlanBranchStates(plan: Plan, particles: readonly Particle[]) {
  const states = new Map<string, PlanBranchState>()
  const visiting = new Set<string>()
  const visit = (id: string): PlanBranchState => {
    if (states.has(id)) return states.get(id)!
    if (visiting.has(id)) return "waiting"
    visiting.add(id)
    const incoming = (plan.links ?? []).filter(link => link.target === id)
    const paths = incoming.map(link => {
      const parent = visit(link.source)
      if (parent === "inactive") return "inactive"
      if (link.outcome) {
        const decision = particles.find(particle => particle.id === link.source)
        if (decision?.type !== "decision" || !decision.data.selectedOutcome) return "waiting"
        if (decision.data.selectedOutcome !== link.outcome) return "inactive"
      }
      return parent
    })
    const state = !paths.length || paths.includes("active") ? "active" : paths.includes("waiting") ? "waiting" : "inactive"
    visiting.delete(id)
    states.set(id, state)
    return state
  }
  plan.particleIds.forEach(visit)
  return states
}

export function particlePlanBranchLabel(plan: Plan, id: string, particles: readonly Particle[]) {
  return (plan.links ?? []).filter(link => link.target === id && link.outcome).flatMap(link => {
    const decision = particles.find(particle => particle.id === link.source)
    const outcome = decision?.type === "decision" ? decision.data.outcomes.find(outcome => outcome.id === link.outcome) : null
    return outcome ? [`${decision!.title}: ${outcome.label}`] : []
  }).join(" / ")
}

export function particlePlanOutcomeReferences(graph: ParticleGraph | null | undefined) {
  return graph?.particles.flatMap(particle => particle.type === "objective" ? [
    ...(particle.data.planning?.plans ?? []),
    ...(particle.data.planning?.proposals ?? []).filter(proposal => proposal.status === "pending"),
  ].flatMap(plan => (plan.links ?? []).filter(link => link.outcome).map(link => ({ source: link.source, outcome: link.outcome }))) : []) ?? []
}
