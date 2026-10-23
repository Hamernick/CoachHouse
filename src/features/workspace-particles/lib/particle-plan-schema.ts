import { z } from "zod"

const members = z.array(z.uuid()).max(250).refine(ids => new Set(ids).size === ids.length, "Plan members must be unique.")
const contents = { title: z.string().trim().min(1).max(240), particleIds: members }
export const particlePlanSchema = z.strictObject({
  id: z.uuid(), revision: z.number().int().nonnegative(), ...contents,
})
export const particlePlanProposalSchema = z.strictObject({
  id: z.uuid(), planId: z.uuid(), baseRevision: z.number().int().nonnegative().nullable(),
  ...contents, authorId: z.uuid(), createdAt: z.iso.datetime(),
  status: z.enum(["pending", "accepted", "rejected"]),
  reviewedBy: z.uuid().optional(), reviewedAt: z.iso.datetime().optional(),
}).refine(value => value.status === "pending"
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
