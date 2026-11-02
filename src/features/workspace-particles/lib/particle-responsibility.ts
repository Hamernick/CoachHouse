import { z } from "zod"
import type { Particle } from "../types"

/** References People records, not auth users or access grants. Names stay at source. */
export const particleResponsibilitySchema = z.strictObject({
  version: z.literal(1),
  ownerId: z.uuid().nullable(),
  contributorIds: z.array(z.uuid()).max(50),
}).refine(value => new Set(value.contributorIds).size === value.contributorIds.length &&
  !value.contributorIds.includes(value.ownerId ?? ""), "Choose each person once.")
export type ParticleResponsibility = z.infer<typeof particleResponsibilitySchema>
export const EMPTY_RESPONSIBILITY: ParticleResponsibility = { version: 1, ownerId: null, contributorIds: [] }

/** Objectives are not plan members. Step responsibility belongs to contextual
 * memberships and must not be stored globally on a reused work record. */
export function supportsParticleResponsibility(particle: { type: string; data: object }) {
  return particle.type === "objective" && !("source" in particle.data && particle.data.source)
}
export function particleResponsiblePeople(particle: Particle) {
  return particleResponsibilityScopes(particle).flatMap(({ value }) => [...(value.ownerId ? [value.ownerId] : []), ...value.contributorIds])
}

/** Keys include membership scope: moving a role between plans requires a fresh check. */
export function particleResponsibilityScopes(particle: Particle) {
  if (particle.type !== "objective") return []
  return [
    ...(particle.responsibility ? [{ key: "objective", value: particle.responsibility }] : []),
    ...(particle.data.planning?.plans ?? []).flatMap(plan => (plan.assignments ?? []).map(item => ({ key: `plan:${plan.id}:${item.particleId}`, value: item.responsibility }))),
    ...(particle.data.planning?.proposals ?? []).flatMap(proposal => (proposal.assignments ?? []).map(item => ({ key: `proposal:${proposal.id}:${item.particleId}`, value: item.responsibility }))),
  ]
}
