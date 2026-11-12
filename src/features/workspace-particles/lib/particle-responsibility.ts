import { z } from "zod"
import type { Particle } from "../types"

/** References team user or invitation IDs; legacy contact IDs remain removable. Names stay at source. */
export const particleResponsibilitySchema = z.strictObject({
  version: z.literal(1),
  ownerId: z.uuid().nullable(),
  contributorIds: z.array(z.uuid()).max(50),
}).refine(value => new Set(value.contributorIds).size === value.contributorIds.length &&
  !value.contributorIds.includes(value.ownerId ?? ""), "Choose each person once.")
export type ParticleResponsibility = z.infer<typeof particleResponsibilitySchema>
export const EMPTY_RESPONSIBILITY: ParticleResponsibility = { version: 1, ownerId: null, contributorIds: [] }

/** Board assignments belong to the canvas record, including linked documents.
 * Plan memberships retain their own independent assignment scopes. */
export function supportsParticleResponsibility(particle: { type: string }) {
  return ["objective", "activity", "calendar", "people", "decision", "metric", "workflow", "finance"].includes(particle.type)
}
export function particleResponsiblePeople(particle: Particle) {
  return particleResponsibilityScopes(particle).flatMap(({ value }) => [...(value.ownerId ? [value.ownerId] : []), ...value.contributorIds])
}

/** Keys include membership scope: moving a role between plans requires a fresh check. */
export function particleResponsibilityScopes(particle: Particle) {
  const own = particle.responsibility ? [{ key: "particle", value: particle.responsibility }] : []
  if (particle.type !== "objective") return own
  return [
    ...own,
    ...(particle.data.planning?.plans ?? []).flatMap(plan => (plan.assignments ?? []).map(item => ({ key: `plan:${plan.id}:${item.particleId}`, value: item.responsibility }))),
    ...(particle.data.planning?.proposals ?? []).flatMap(proposal => (proposal.assignments ?? []).map(item => ({ key: `proposal:${proposal.id}:${item.particleId}`, value: item.responsibility }))),
  ]
}
