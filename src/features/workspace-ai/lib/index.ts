import { z } from "zod"

export const aiDocumentTargetSchema = z.object({
  organizationId: z.uuid(), userId: z.uuid(), sectionId: z.string().min(1).max(100),
  title: z.string().max(200), revision: z.string().nullable(),
}).strict()
export const aiTextSelectionSchema = z.object({
  from: z.number().int().nonnegative().max(10000000), to: z.number().int().positive().max(10000000),
  html: z.string().min(1).max(6000),
}).strict().refine(value => value.to > value.from, "Select some text first.")
export const aiDocumentRequestSchema = z.object({
  id: z.uuid(), target: aiDocumentTargetSchema, prompt: z.string().trim().min(1).max(4000),
  maximumCredits: z.number().int().positive().max(125), tariffVersion: z.string().min(1).max(80),
  reviseRunId: z.uuid().optional(), selection: aiTextSelectionSchema.optional(),
}).strict()
export const aiApplicationSchema = z.object({
  run_id:z.uuid(),section_id:z.string(),saved_revision:z.string(),content_hash:z.string().length(64),saved_at:z.string(),
})
export const storedAiRunSchema = z.object({
  id: z.uuid(), status: z.enum(["reserved","running","reconciling","succeeded","failed","canceled"]),
  actor_id: z.uuid(), org_id: z.uuid(), target: aiDocumentTargetSchema.extend({ content: z.string().max(100000),revisionSourceRunId:z.uuid().optional(),selection:aiTextSelectionSchema.optional() }),
  proposal: z.string().nullable(), charged_credits: z.number().nullable(), max_credits: z.number(),
  application: aiApplicationSchema.nullable().optional(),
})
export function aiRunProposal(value: unknown) {
  const run = storedAiRunSchema.parse(value)
  const { content,revisionSourceRunId,selection, ...target } = run.target
  return { id: run.id, target, original: content, content: run.proposal ?? "", status: run.status,
    credits: run.charged_credits, maxCredits: run.max_credits,application:run.application ?? null,revisionSourceRunId,selection }
}
