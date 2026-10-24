import type { ParticleGraph } from "../types"

export type PlanningActor = { userId: string; isOrganizationOwner: boolean }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// Runs inside the authenticated board writer on every CAS retry, never only in UI.
export function particlePlanningPermissionError(before: ParticleGraph, after: ParticleGraph, actor: PlanningActor | undefined, now: string): string | null {
  const objectives = new Set([...before.particles, ...after.particles].filter(item => item.type === "objective").map(item => item.id))
  for (const id of objectives) {
    const previous = before.particles.find(item => item.id === id)
    const next = after.particles.find(item => item.id === id)
    const old = previous?.type === "objective" ? previous.data.planning : undefined
    const value = next?.type === "objective" ? next.data.planning : undefined
    if (same(old, value)) continue
    if (!actor) return "Planning changes require an authenticated organization member."
    if (!actor.isOrganizationOwner && !same(old?.plans ?? [], value?.plans ?? []))
      return "Only the organization owner can change the accepted plan. Submit a proposal."
    for (const proposal of old?.proposals ?? []) {
      const updated = value?.proposals.find(item => item.id === proposal.id)
      if (!updated) return "Proposal history cannot be removed."
      if (same(updated, proposal)) continue
      if (proposal.status !== "pending") return "Reviewed proposals cannot be changed."
      if (updated.authorId !== proposal.authorId || updated.createdAt !== proposal.createdAt || updated.planId !== proposal.planId || updated.baseRevision !== proposal.baseRevision)
        return "Proposal authorship and base revision cannot be changed."
      if (!actor.isOrganizationOwner && proposal.authorId !== actor.userId)
        return "Only the author or organization owner can edit this proposal."
      if (updated.status === "pending") continue
      if (!actor.isOrganizationOwner || updated.reviewedBy !== actor.userId || updated.reviewedAt !== now)
        return "Only the organization owner can review proposals."
      if (updated.status === "rejected") continue
      const base = old?.plans.find(item => item.id === proposal.planId)
      if ((base?.revision ?? null) !== proposal.baseRevision)
        return "The accepted plan changed. Create a fresh proposal before accepting."
      const accepted = value?.plans.find(item => item.id === proposal.planId)
      if (!accepted || accepted.title !== updated.title || !same(accepted.particleIds, updated.particleIds) || !same(accepted.links, updated.links) || !same(accepted.sources, updated.sources) || accepted.researchRunId !== updated.researchRunId || accepted.summary !== updated.summary)
        return "Accept the proposal and its plan changes together."
    }
    for (const proposal of value?.proposals ?? []) {
      if (old?.proposals.some(item => item.id === proposal.id)) continue
      if (proposal.status !== "pending" || proposal.authorId !== actor.userId)
        return "New proposals must be pending and belong to their author."
      const base = old?.plans.find(item => item.id === proposal.planId)
      if ((base?.revision ?? null) !== proposal.baseRevision)
        return "The plan changed. Refresh before submitting your proposal."
    }
  }
  return null
}
