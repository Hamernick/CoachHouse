import { z } from "zod"

export const knowledgeKindSchema = z.enum(["organization", "person", "document", "calendar", "particle", "opportunity"])
export const researchTargetSchema = z.strictObject({ organizationId: z.uuid(), objectiveId: z.uuid(), revision: z.number().int().nonnegative(),
  plan: z.strictObject({ id: z.uuid(), revision: z.number().int().nonnegative() }).optional(),
})
export const researchRequestSchema = z.strictObject({ id: z.uuid(), target: researchTargetSchema, prompt: z.string().trim().min(1).max(2000), tariffVersion: z.string().min(1).max(80), maximumCredits: z.number().int().positive().max(125), skill: z.enum(["research", "partnerships", "planning"]) })
export const knowledgeSearchSchema = z.strictObject({ query: z.string().trim().min(1).max(160), kinds: z.array(knowledgeKindSchema).min(1).max(6) })
export const knowledgeReadSchema = z.strictObject({ ids: z.array(z.string().min(1).max(200)).min(1).max(4) })
export const researchSourceSchema = z.strictObject({ id: z.string().max(200), title: z.string().max(240), href: z.string().max(2000).refine(value => /^\/(?!\/)/.test(value) || /^https?:\/\//.test(value), "Invalid source link"), revision: z.string().nullable(), checkedAt: z.iso.datetime(), kind: z.enum(["workspace", "web"]), file: z.strictObject({size:z.number().int().positive().max(15728640),format:z.enum(["pdf","md","docx","doc","csv","txt","image"])}).optional() })
const researchKey = z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/)
const removeReferencesSchema = z.array(z.string().regex(/^particle:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)).max(40)
const researchDecisionsSchema = z.array(z.strictObject({
  itemKey: researchKey,
  outcomes: z.array(z.strictObject({ key: z.string().regex(/^[a-z][a-z0-9_-]{0,47}$/), label: z.string().trim().min(1).max(240), next: z.array(researchKey).max(12) })).min(2).max(12),
})).max(6)
export const generatedResearchSchema = z.strictObject({
  title: z.string().min(1).max(240), summary: z.string().max(1500),
  questions: z.array(z.string().max(300)).max(5),
  decisions: researchDecisionsSchema,
  removeReferences: removeReferencesSchema,
  items: z.array(z.strictObject({ key: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/), title: z.string().min(1).max(240),
    kind: z.enum(["resource", "note", "event", "decision", "reference"]), description: z.string().max(1800),
    referenceId: z.string().max(200).nullable(), evidenceIds: z.array(z.string().max(200)).max(8),
    dependsOn: z.array(z.string().max(40)).max(8),
  })).max(12),
})
export const researchResultSchema = z.strictObject({ ...generatedResearchSchema.shape, decisions: researchDecisionsSchema.optional(), removeReferences: removeReferencesSchema.optional(), sources: z.array(researchSourceSchema).max(40), target: researchTargetSchema, runId: z.uuid() })
export type ResearchTarget = z.infer<typeof researchTargetSchema>
export type ResearchResult = z.infer<typeof researchResultSchema>
export type ResearchRequest = z.infer<typeof researchRequestSchema>
export type KnowledgeKind = z.infer<typeof knowledgeKindSchema>
export type KnowledgeRecord = { id: string; kind: KnowledgeKind; title: string; content: string; href: string; revision: string | null; contentAvailable: boolean; contentTruncated?: boolean; contentScope?: "document_body" | "text"; file?: ResearchSource["file"] }
export type ResearchSource = z.infer<typeof researchSourceSchema>
