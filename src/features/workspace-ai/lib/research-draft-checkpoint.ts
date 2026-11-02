import { z } from "zod"
import { researchDraftSchema, researchRecoveryDraftSchema } from "./research-draft"

export const researchDraftCheckpointSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  draft: researchRecoveryDraftSchema.nullable(),
  attempted: z.boolean(),
}).refine(value => !value.attempted || value.draft !== null)
export type ResearchDraftCheckpoint = z.infer<typeof researchDraftCheckpointSchema>
export const researchDraftWriteSchema = z.strictObject({
  revision: z.number().int().nonnegative(), editId: z.uuid(),
  draft: researchRecoveryDraftSchema.nullable(), attempted: z.boolean(),
}).refine(value => !value.attempted || value.draft !== null)
export type ResearchDraftWrite = z.infer<typeof researchDraftWriteSchema>
export type ResearchDraftReply = { checkpoint: ResearchDraftCheckpoint } | { error: string; conflict?: boolean }

/** Compare validated values, not incidental object insertion order. */
export function sameResearchDraft(left: unknown, right: unknown): boolean {
  const schema = z.union([researchRecoveryDraftSchema, researchDraftSchema])
  const a = schema.safeParse(left), b = schema.safeParse(right)
  return a.success && b.success && JSON.stringify(a.data) === JSON.stringify(b.data)
}
