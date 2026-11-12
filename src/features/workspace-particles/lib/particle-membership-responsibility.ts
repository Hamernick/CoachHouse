import type { ParticleGraph, ParticleOperation } from "../types"
import type { PlanningActor } from "./particle-plan-authority"
import { planCommand } from "./particle-plan-command"
import { EMPTY_RESPONSIBILITY, particleResponsibilitySchema, type ParticleResponsibility } from "./particle-responsibility"

export type MembershipReference = { workspaceId: string; objectiveId: string; planId: string; proposalId?: string }
export type MembershipResponsibility = MembershipReference & {
  key: string
  label: string
  revision: number
  value: ParticleResponsibility
  editable: boolean
}
export const membershipResponsibilityKey = (scope: MembershipReference) => `${scope.workspaceId}:${scope.objectiveId}:${scope.planId}:${scope.proposalId ?? "accepted"}`

/** Membership is local to an objective/plan/proposal, never to the reused record. */
export function particleMembershipResponsibilities(graph: ParticleGraph | null, actor?: PlanningActor) {
  const result = new Map<string, MembershipResponsibility[]>()
  for (const objective of graph?.particles ?? []) {
    if (objective.type !== "objective") continue
    const planning = objective.data.planning
    const contexts = [
      ...(planning?.plans ?? []).map(plan => ({ plan, proposalId: undefined, planId: plan.id, editable: Boolean(actor?.isOrganizationOwner) })),
      ...(planning?.proposals ?? []).filter(proposal => proposal.status === "pending").map(plan => ({ plan, proposalId: plan.id, planId: plan.planId, editable: Boolean(actor && (actor.isOrganizationOwner || actor.userId === plan.authorId)) })),
    ]
    for (const { plan, proposalId, planId, editable } of contexts) {
      const reference = { workspaceId: objective.workspaceId, objectiveId: objective.id, planId, ...(proposalId ? { proposalId } : {}) }
      for (const id of plan.particleIds) {
        const context: MembershipResponsibility = { ...reference, key: membershipResponsibilityKey(reference),
          label: `${objective.title === plan.title ? plan.title : `${objective.title} / ${plan.title}`}${proposalId ? " · Proposed" : ""}`,
          revision: objective.revision, value: plan.assignments?.find(item => item.particleId === id)?.responsibility ?? EMPTY_RESPONSIBILITY,
          editable: editable && !objective.locked && !objective.data.source }
        result.set(id, [...(result.get(id) ?? []), context])
      }
    }
  }
  return result
}

/** Reject a stale or removed context before entering the existing authorized writer.
 * Server-side source access, actor checks and CAS remain authoritative. */
export function membershipResponsibilityOperation(graph: ParticleGraph | null, particleId: string, scope: MembershipResponsibility, value: ParticleResponsibility, actor?: PlanningActor): ParticleOperation | null {
  if (graph?.workspaceId !== scope.workspaceId || !graph.particles.some(item => item.id === particleId)) return null
  const current = particleMembershipResponsibilities(graph, actor).get(particleId)?.find(item => item.key === scope.key)
  if (!current?.editable || current.revision !== scope.revision) return null
  const parsed = particleResponsibilitySchema.safeParse(value)
  if (!parsed.success) return null
  const objective = graph.particles.find(item => item.id === current.objectiveId)
  if (objective?.type !== "objective" || !objective.data.planning) return null
  const planning = objective.data.planning
  const target = current.proposalId ? planning.proposals.find(item => item.id === current.proposalId) : planning.plans.find(item => item.id === current.planId)
  if (!target) return null
  const assignments = [...(target.assignments ?? []).filter(item => item.particleId !== particleId), { particleId, responsibility: parsed.data }]
  if (!current.proposalId && "revision" in target) return planCommand(objective, { ...target, assignments })
  return { kind: "put_particle", expectedRevision: objective.revision, particle: { ...objective, data: { ...objective.data,
    planning: { ...planning, proposals: planning.proposals.map(item => item.id === current.proposalId ? { ...item, assignments } : item) },
  } } }
}

/** Geometry needs only membership presence; it never picks an assignment scope. */
export function hasParticleMembership(graph: ParticleGraph | null | undefined, id: string) {
  return Boolean(graph?.particles.some(item => item.type === "objective" && (
    item.data.planning?.plans.some(plan => plan.particleIds.includes(id)) ||
    item.data.planning?.proposals.some(plan => plan.status === "pending" && plan.particleIds.includes(id))
  )))
}
