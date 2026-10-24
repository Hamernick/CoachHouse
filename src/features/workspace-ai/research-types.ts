import { z } from "zod"

export const knowledgeKindSchema = z.enum(["organization", "person", "document", "calendar", "particle", "opportunity"])
export const researchTargetSchema = z.strictObject({ organizationId: z.uuid(), objectiveId: z.uuid(), revision: z.number().int().nonnegative() })
export const researchRequestSchema = z.strictObject({ id: z.uuid(), target: researchTargetSchema, prompt: z.string().trim().min(1).max(2000), tariffVersion: z.string().min(1).max(80), maximumCredits: z.number().int().positive().max(125), skill: z.enum(["research", "partnerships", "planning"]) })
export const knowledgeSearchSchema = z.strictObject({ query: z.string().trim().min(1).max(160), kinds: z.array(knowledgeKindSchema).min(1).max(6) })
export const knowledgeReadSchema = z.strictObject({ ids: z.array(z.string().min(1).max(200)).min(1).max(4) })
export const researchSourceSchema = z.strictObject({ id: z.string().max(200), title: z.string().max(240), href: z.string().max(2000).refine(value => /^\/(?!\/)/.test(value) || /^https?:\/\//.test(value), "Invalid source link"), revision: z.string().nullable(), checkedAt: z.iso.datetime(), kind: z.enum(["workspace", "web"]), file: z.strictObject({size:z.number().int().positive().max(15728640),format:z.enum(["pdf","md","docx","doc","csv","txt","image"])}).optional() })
export const generatedResearchSchema = z.strictObject({
  title: z.string().min(1).max(240), summary: z.string().max(1500),
  questions: z.array(z.string().max(300)).max(5),
  items: z.array(z.strictObject({ key: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/), title: z.string().min(1).max(240),
    kind: z.enum(["resource", "note", "event", "decision", "reference"]), description: z.string().max(1800),
    referenceId: z.string().max(200).nullable(), evidenceIds: z.array(z.string().max(200)).max(8),
    dependsOn: z.array(z.string().max(40)).max(8),
  })).max(12),
})
export const researchResultSchema = z.strictObject({ ...generatedResearchSchema.shape, sources: z.array(researchSourceSchema).max(40), target: researchTargetSchema, runId: z.uuid() })
export type ResearchTarget = z.infer<typeof researchTargetSchema>
export type ResearchResult = z.infer<typeof researchResultSchema>
export type ResearchRequest = z.infer<typeof researchRequestSchema>
export type KnowledgeKind = z.infer<typeof knowledgeKindSchema>
export type KnowledgeRecord = { id: string; kind: KnowledgeKind; title: string; content: string; href: string; revision: string | null; contentAvailable: boolean; file?: ResearchSource["file"] }
export type ResearchSource = z.infer<typeof researchSourceSchema>
