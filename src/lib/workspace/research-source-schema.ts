import { z } from "zod"

/** Shared strict evidence contract for AI results and canonical saved plans. */
export const knowledgePersonFieldSchema = z.enum(["title", "email", "phone", "notes", "details.organization", "details.location", "details.website", "details.timezone", "details.relationshipStage", "details.followUpDate"])
export const knowledgePersonFieldsSchema = z.array(knowledgePersonFieldSchema).min(1).max(10).refine(fields => new Set(fields).size === fields.length, "Choose distinct contact fields")

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
export const researchSourceSchema = z.strictObject({ id: z.string().max(200), title: z.string().max(240), href: z.string().max(2000).refine(value => /^\/(?!\/)/.test(value) || /^https?:\/\//.test(value), "Invalid source link"), revision: z.string().nullable(), checkedAt: z.iso.datetime(), kind: z.enum(["workspace", "web"]), evidence: knowledgeEvidenceSchema.optional(), file: z.strictObject({size:z.number().int().positive().max(15728640),format:z.enum(["pdf","md","docx","doc","csv","txt","image"])}).optional() })
