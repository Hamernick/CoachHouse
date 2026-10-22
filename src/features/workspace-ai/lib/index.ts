import { z } from "zod"

export const aiDocumentTargetSchema = z.object({
  organizationId: z.uuid(), userId: z.uuid(), sectionId: z.string().min(1).max(100),
  title: z.string().max(200), revision: z.string().nullable(),
}).strict()
export const aiDocumentRequestSchema = z.object({
  id: z.uuid(), target: aiDocumentTargetSchema, prompt: z.string().trim().min(1).max(4000),
  maximumCredits: z.number().int().positive().max(125), tariffVersion: z.string().min(1).max(80),
}).strict()
export const storedAiRunSchema = z.object({
  id: z.uuid(), status: z.enum(["reserved","running","reconciling","succeeded","failed","canceled"]),
  actor_id: z.uuid(), org_id: z.uuid(), target: aiDocumentTargetSchema.extend({ content: z.string().max(100000) }),
  proposal: z.string().nullable(), charged_credits: z.number().nullable(), max_credits: z.number(),
})
export function aiRunProposal(value: unknown) {
  const run = storedAiRunSchema.parse(value)
  const { content, ...target } = run.target
  return { id: run.id, target, original: content, content: run.proposal ?? "", status: run.status,
    credits: run.charged_credits, maxCredits: run.max_credits }
}
