import { researchPublicBriefSchema } from "./lib/research-public-brief"
import { z } from "zod"
import { knowledgePersonFieldSchema, knowledgePersonFieldsSchema, type KnowledgePersonData, type KnowledgePersonField } from "./lib/knowledge-person-fields"
import type { KnowledgeAvailability } from "./lib/knowledge-availability"
import { formDefinitionSchema } from "@/features/organization-forms"
import { providerResearchFormSchema } from "./lib/research-form"
import { researchDataViewSchema, researchOutputBindingsSchema } from "./lib/research-data-view"

export const knowledgeKindSchema = z.enum(["organization", "person", "document", "calendar", "particle", "opportunity"])
export const existingResearchTargetSchema = z.strictObject({ organizationId: z.uuid(), objectiveId: z.uuid(), revision: z.number().int().nonnegative(),
  plan: z.strictObject({ id: z.uuid(), revision: z.number().int().nonnegative() }).optional(),
  mode: z.never().optional(),
})
export const newObjectiveTargetSchema = z.strictObject({
  mode: z.literal("new_objective"), organizationId: z.uuid(), canvasId: z.uuid().nullable(),
  revision: z.number().int().nonnegative(), objectiveId: z.never().optional(), plan: z.never().optional(),
})
export const researchTargetSchema = z.union([existingResearchTargetSchema, newObjectiveTargetSchema])
export type ExistingResearchTarget = z.infer<typeof existingResearchTargetSchema>
export type NewObjectiveTarget = z.infer<typeof newObjectiveTargetSchema>
export const researchRequestSchema = z.strictObject({ id: z.uuid(), target: researchTargetSchema, prompt: z.string().trim().min(1).max(2000), tariffVersion: z.string().min(1).max(80), maximumCredits: z.number().int().positive().max(125), skill: z.enum(["research", "partnerships", "planning"]), publicResearch: researchPublicBriefSchema.optional() })
export const knowledgeSearchSchema = z.strictObject({ query: z.string().trim().min(1).max(160), kinds: z.array(knowledgeKindSchema).min(1).max(6) })
export const knowledgeReadSchema = z.strictObject({ ids: z.array(z.string().min(1).max(200)).min(1).max(4), personFields: knowledgePersonFieldsSchema.nullable().optional() })
// The model-facing strict tool declares every property; older callers may omit it safely.
export const knowledgeProviderReadSchema = knowledgeReadSchema.extend({ personFields: knowledgePersonFieldsSchema.nullable() })
export const knowledgeEvidenceSchema = z.strictObject({
  version: z.literal(1),
  coverage: z.enum(["metadata_only", "excerpt", "complete", "unavailable"]),
  scope: z.enum(["record", "text", "document_body", "selected_plan"]),
  checkedAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
  // JavaScript string length: UTF-16 code units, not bytes or tokens.
  characters: z.number().int().nonnegative().max(20000),
  contactFields: knowledgePersonFieldsSchema.optional(),
})
export type KnowledgeEvidence = z.infer<typeof knowledgeEvidenceSchema>
export const researchSourceSchema = z.strictObject({ id: z.string().max(200), title: z.string().max(240), href: z.string().max(2000).refine(value => /^\/(?!\/)/.test(value) || /^https?:\/\//.test(value), "Invalid source link"), revision: z.string().nullable(), checkedAt: z.iso.datetime(), kind: z.enum(["workspace", "web"]), evidence: knowledgeEvidenceSchema.optional(), file: z.strictObject({size:z.number().int().positive().max(15728640),format:z.enum(["pdf","md","docx","doc","csv","txt","image"])}).optional() })
const researchKey = z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/)
const removeReferencesSchema = z.array(z.string().regex(/^particle:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)).max(40)
const researchDecisionsSchema = z.array(z.strictObject({
  itemKey: researchKey,
  outcomes: z.array(z.strictObject({ key: z.string().regex(/^[a-z][a-z0-9_-]{0,47}$/), label: z.string().trim().min(1).max(240), next: z.array(researchKey).max(12) })).min(2).max(12),
})).max(6)
const unfulfilledOutputsSchema = z.array(z.string().trim().min(1).max(300)).max(8)

export const generatedResearchSchema = z.strictObject({
  title: z.string().min(1).max(240), summary: z.string().max(1500),
  questions: z.array(z.string().max(300)).max(5),
  // Optional only for historical results; new provider responses must declare this.
  unfulfilled: unfulfilledOutputsSchema.optional(),
  decisions: researchDecisionsSchema,
  removeReferences: removeReferencesSchema,
  items: z.array(z.strictObject({ key: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/), title: z.string().min(1).max(240),
    kind: z.enum(["resource", "note", "event", "decision", "reference", "form", "data_view"]), description: z.string().max(1800),
    form: formDefinitionSchema.nullable().optional(),
    dataView: researchDataViewSchema.nullable().optional(),
    referenceId: z.string().max(200).nullable(), evidenceIds: z.array(z.string().max(200)).max(8),
    dependsOn: z.array(z.string().max(40)).max(8),
  })).max(12),
})
// The provider must report omitted outputs; an empty list is not proof of completeness.
export const providerResearchSchema = generatedResearchSchema.extend({ unfulfilled: unfulfilledOutputsSchema,
  items: z.array(generatedResearchSchema.shape.items.element.omit({ form: true, dataView: true }).extend({
    kind: z.enum(["resource", "note", "event", "decision", "reference"]),
  })).max(12),
})
export const providerFormResearchSchema = generatedResearchSchema.extend({ unfulfilled: unfulfilledOutputsSchema,
  items: z.array(generatedResearchSchema.shape.items.element.omit({ dataView: true }).extend({ form: providerResearchFormSchema.nullable(),
    kind: z.enum(["resource", "note", "event", "decision", "reference", "form"]),
  })).max(12),
})
export const providerDataViewResearchSchema = generatedResearchSchema.extend({ unfulfilled: unfulfilledOutputsSchema,
  items: z.array(generatedResearchSchema.shape.items.element.omit({ form: true }).extend({ dataView: researchDataViewSchema.nullable(),
    kind: z.enum(["resource", "note", "event", "decision", "reference", "data_view"]),
  })).max(12),
})
export const providerWorkingResearchSchema = generatedResearchSchema.extend({ unfulfilled: unfulfilledOutputsSchema,
  items: z.array(generatedResearchSchema.shape.items.element.extend({ form: providerResearchFormSchema.nullable(), dataView: researchDataViewSchema.nullable() })).max(12),
})

// Server-authored dependency metadata; never part of the model output schema.
export const researchDependenciesSchema = z.strictObject({
  version: z.literal(1),
  contextFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  records: z.array(z.strictObject({
    id: z.string().min(1).max(200), kind: knowledgeKindSchema,
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    detailFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    contactFields: z.array(z.strictObject({ field: knowledgePersonFieldSchema, fingerprint: z.string().regex(/^[a-f0-9]{64}$/) })).min(1).max(10).optional(),
  }).refine(record => !record.contactFields || (record.kind === "person" && new Set(record.contactFields.map(item => item.field)).size === record.contactFields.length))).max(256),
})
export type ResearchDependencies = z.infer<typeof researchDependenciesSchema>
export const researchResultSchema = z.strictObject({ ...generatedResearchSchema.shape, decisions: researchDecisionsSchema.optional(), removeReferences: removeReferencesSchema.optional(), sources: z.array(researchSourceSchema).max(40), dependencies: researchDependenciesSchema.optional(), outputBindings: researchOutputBindingsSchema.optional(), target: researchTargetSchema, runId: z.uuid() })
export type ResearchTarget = z.infer<typeof researchTargetSchema>
export const researchHistorySchema = z.array(z.strictObject({
  id: z.uuid(), created_at: z.iso.datetime({ offset: true }),
  status: z.enum(["reserved", "running", "reconciling", "succeeded", "failed", "canceled"]),
})).max(12)
export type ResearchHistory = z.infer<typeof researchHistorySchema>
export type ResearchResult = z.infer<typeof researchResultSchema>
export type ResearchRequest = z.infer<typeof researchRequestSchema>
export type KnowledgeKind = z.infer<typeof knowledgeKindSchema>
export type KnowledgeRecord = { personData?: KnowledgePersonData; contactFields?: KnowledgePersonField[]; availability?: KnowledgeAvailability; id: string; kind: KnowledgeKind; title: string; content: string; href: string; revision: string | null; contentAvailable: boolean; searchContent?: string; contentTruncated?: boolean; contentScope?: "document_body" | "text"; file?: ResearchSource["file"] }
export type ResearchSource = z.infer<typeof researchSourceSchema>
