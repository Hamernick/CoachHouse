import { z } from "zod"
import { knowledgeEvidenceSchema, knowledgeKindSchema, researchSourceSchema } from "../research-types"
import { knowledgeAvailabilitySchema, knowledgeRecoverySchema } from "./knowledge-availability"

/** Existing two tools only. No new permission, tool registry or outbound route. */
export const knowledgeDisclosedRecordSchema = z.strictObject({
  id: z.string().min(1).max(200), kind: knowledgeKindSchema, title: z.string().max(240), href: z.string().max(2000).regex(/^\/(?!\/)/),
  revision: z.string().max(2000).nullable(), content: z.string().max(20000), contentAvailable: z.boolean(), truncated: z.boolean(), evidence: knowledgeEvidenceSchema,
  contentScope: z.enum(["document_body", "text"]).optional(), file: researchSourceSchema.shape.file,
  status: knowledgeAvailabilitySchema.exclude(["changed"]), recovery: knowledgeRecoverySchema,
}).refine(value => {
  const prefix = value.id.split(":")[0]
  if ((prefix === "file" ? "document" : prefix) !== value.kind) return false
  if (value.contentAvailable !== ["available", "truncated"].includes(value.status)) return false
  if (value.status === "available" && (value.truncated || value.evidence.coverage !== "complete")) return false
  if (value.status === "truncated" && (!value.truncated || value.evidence.coverage !== "excerpt")) return false
  if (!value.contentAvailable && value.evidence.coverage !== (value.status === "metadata_only" ? "metadata_only" : "unavailable")) return false
  if (value.evidence.characters !== (value.contentAvailable ? value.content.length : 0)) return false
  const recovery = { available: "none", truncated: "narrow_source", metadata_only: "read_detail", unavailable: "retry_read", unsupported_format: "choose_source", exhausted_budget: "narrow_source", empty: "choose_source" }
  return value.recovery === recovery[value.status]
}, "Inconsistent source evidence")
export const knowledgeReadFailureSchema = z.strictObject({ id: z.string().min(1).max(200), status: z.enum(["changed", "unavailable"]),
  recovery: z.enum(["restart_research", "retry_read"]), error: z.enum(["Source changed. Restart research for current evidence.", "Contents could not be verified. Retry the read; do not infer their contents."]) })
  .refine(value => value.status === "changed" ? value.recovery === "restart_research" && value.error.startsWith("Source changed.") : value.recovery === "retry_read" && value.error.startsWith("Contents could not"))
const envelope = { version: z.literal(1), scope: z.strictObject({ organizationId: z.uuid(), canvasId: z.uuid().nullable() }),
  effect: z.literal("internal_read"), disclosure: z.strictObject({ destination: z.literal("configured_workspace_model"), sensitivity: z.literal("organization_private"), publicDisclosure: z.literal(false) }) }
export const knowledgeSearchResultSchema = z.strictObject({ ...envelope,
  results: z.array(knowledgeDisclosedRecordSchema.safeExtend({ content: z.string().max(480) })).max(8),
  unavailableKinds: z.array(knowledgeKindSchema).max(6), limit: z.literal(8), note: z.string().max(300),
})
export const knowledgeReadResultSchema = z.strictObject({ ...envelope,
  results: z.array(z.union([knowledgeDisclosedRecordSchema, knowledgeReadFailureSchema])).max(4),
}).refine(value => value.results.reduce((sum, item) => sum + ("content" in item ? item.content.length : 0), 0) <= 6000, "Read text exceeds its UTF-16 character budget")

/** UTF-16 text limits are not token estimates. The provider dispatch separately
 * measures the entire UTF-8 request against its unchanged 20,000-byte ceiling. */
export function validateKnowledgeToolResult(name: string, value: unknown, scope: { organizationId: string; canvasId: string | null }) {
  const result = name === "search_workspace" ? knowledgeSearchResultSchema.parse(value)
    : name === "read_workspace" ? knowledgeReadResultSchema.parse(value) : null
  if (!result) throw new Error("Tool is not available.")
  if (result.scope.organizationId !== scope.organizationId || result.scope.canvasId !== scope.canvasId) throw new Error("Tool scope changed.")
  return result
}
export const unavailableKnowledgeToolResult = { version: 1, status: "unavailable", recovery: "retry_read",
  error: "This authorized source or tool could not be verified. Retry the read; do not infer its contents." } as const
