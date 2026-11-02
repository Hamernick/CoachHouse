import { z } from "zod"
import { particleResponsibilitySchema } from "./particle-responsibility"

const members = z.array(z.uuid()).max(250).refine(ids => new Set(ids).size === ids.length, "Plan members must be unique.")
const contents = { title: z.string().trim().min(1).max(240), particleIds: members,
  optionalParticleIds: members.optional(),
  assignments: z.array(z.strictObject({ particleId: z.uuid(), responsibility: particleResponsibilitySchema })).max(250).optional(),
  links: z.array(z.strictObject({ source: z.uuid(), target: z.uuid(), outcome: z.string().regex(/^[a-z][a-z0-9_-]{0,47}$/).optional() })).max(60).optional(),
  researchRunId: z.uuid().optional(),
  summary: z.string().max(1500).optional(),
  sources: z.array(z.strictObject({ id:z.string().max(200), title:z.string().max(240), href:z.string().max(2000).refine(value => /^\/(?!\/)/.test(value) || /^https?:\/\//.test(value), "Invalid source link"), revision:z.string().nullable(), checkedAt:z.iso.datetime(), kind:z.enum(["workspace","web"]), file:z.strictObject({size:z.number().int().positive().max(15728640),format:z.enum(["pdf","md","docx","doc","csv","txt","image"])}).optional() })).max(40).optional(),
}
const validAssignments = (value: { particleIds: string[]; assignments?: { particleId: string }[]; optionalParticleIds?: string[] }) =>
  (value.optionalParticleIds ?? []).every(id => value.particleIds.includes(id)) &&
  new Set(value.assignments?.map(item => item.particleId)).size === (value.assignments?.length ?? 0) &&
  (value.assignments ?? []).every(item => value.particleIds.includes(item.particleId))
export const particlePlanSchema = z.strictObject({
  id: z.uuid(), revision: z.number().int().nonnegative(), ...contents,
}).refine(validAssignments, "Assignments must reference distinct plan members.")
export const particlePlanProposalSchema = z.strictObject({
  id: z.uuid(), planId: z.uuid(), baseRevision: z.number().int().nonnegative().nullable(),
  ...contents, authorId: z.uuid(), createdAt: z.iso.datetime(),
  status: z.enum(["pending", "accepted", "rejected"]),
  reviewedBy: z.uuid().optional(), reviewedAt: z.iso.datetime().optional(),
}).refine(validAssignments, "Assignments must reference distinct plan members.").refine(value => value.status === "pending"
  ? !value.reviewedBy && !value.reviewedAt
  : Boolean(value.reviewedBy && value.reviewedAt), "Review requires an actor and timestamp.")
export const particlePlanningSchema = z.strictObject({
  plans: z.array(particlePlanSchema).max(40),
  proposals: z.array(particlePlanProposalSchema).max(100),
}).refine(value => new Set(value.plans.map(plan => plan.id)).size === value.plans.length &&
  new Set(value.proposals.map(proposal => proposal.id)).size === value.proposals.length, "Planning IDs must be unique.")
export type ParticlePlan = z.infer<typeof particlePlanSchema>
export type ParticlePlanProposal = z.infer<typeof particlePlanProposalSchema>
export type ParticlePlanning = z.infer<typeof particlePlanningSchema>

/** Keep review-only fields out of the strict accepted-plan contract. */
export function planFromProposal(proposal: ParticlePlanProposal): ParticlePlan {
  const { planId, baseRevision, title, particleIds, assignments, optionalParticleIds, links, researchRunId, summary, sources } = proposal
  return { id: planId, revision: baseRevision ?? 0, title, particleIds,
    ...(assignments ? { assignments } : {}), ...(optionalParticleIds ? { optionalParticleIds } : {}), ...(links ? { links } : {}), ...(researchRunId ? { researchRunId } : {}),
    ...(summary !== undefined ? { summary } : {}), ...(sources ? { sources } : {}) }
}
