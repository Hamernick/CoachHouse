import { z } from "zod"
import { RESEARCH_CONTRACT_VERSION } from "./research-skills"
import { knowledgePersonFieldsSchema } from "./knowledge-person-fields"
import { knowledgeSearchSchema, knowledgeReadSchema, knowledgeProviderReadSchema, knowledgeEvidenceSchema, knowledgeKindSchema, researchSourceSchema } from "../research-types"
import { knowledgeAvailabilitySchema, knowledgeRecoverySchema } from "./knowledge-availability"

/** Existing two tools only. No new permission, tool registry or outbound route. */
export const knowledgeDisclosedRecordSchema = z.strictObject({
  id: z.string().min(1).max(200), kind: knowledgeKindSchema, title: z.string().max(240), href: z.string().max(2000).regex(/^\/(?!\/)/),
  revision: z.string().max(2000).nullable(), content: z.string().max(20000), contentAvailable: z.boolean(), truncated: z.boolean(), evidence: knowledgeEvidenceSchema,
  contactFields: knowledgePersonFieldsSchema.optional(),
  contentScope: z.enum(["document_body", "text"]).optional(), file: researchSourceSchema.shape.file,
  status: knowledgeAvailabilitySchema.exclude(["changed"]), recovery: knowledgeRecoverySchema,
}).refine(value => {
  const prefix = value.id.split(":")[0]
  if ((prefix === "file" ? "document" : prefix) !== value.kind) return false
  if (value.contactFields && value.kind !== "person") return false
  if (JSON.stringify(value.contactFields) !== JSON.stringify(value.evidence.contactFields)) return false
  if (value.contentAvailable !== ["available", "truncated"].includes(value.status)) return false
  if (value.status === "available" && (value.truncated || value.evidence.coverage !== "complete")) return false
  if (value.status === "truncated" && (!value.truncated || value.evidence.coverage !== "excerpt")) return false
  if (!value.contentAvailable && value.evidence.coverage !== (value.status === "metadata_only" ? "metadata_only" : "unavailable")) return false
  if (value.evidence.characters !== (value.contentAvailable ? value.content.length : 0)) return false
  const recovery = { available: "none", truncated: value.evidence.readAt === null ? "read_detail" : "narrow_source", metadata_only: "read_detail", unavailable: "retry_read", unsupported_format: "choose_source", exhausted_budget: "narrow_source", empty: "choose_source" }
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
export function validateKnowledgeToolResult(name: string, value: unknown, scope: { organizationId: string; canvasId: string | null }, args?: unknown) {
  const result = name === "search_workspace" ? knowledgeSearchResultSchema.parse(value)
    : name === "read_workspace" ? knowledgeReadResultSchema.parse(value) : null
  if (!result) throw new Error("Tool is not available.")
  if (result.scope.organizationId !== scope.organizationId || result.scope.canvasId !== scope.canvasId) throw new Error("Tool scope changed.")
  if (args !== undefined) {
    if (name === "read_workspace") {
      const input = knowledgeReadSchema.parse(args), ids = [...new Set(input.ids)]
      if (result.results.length !== ids.length || new Set(result.results.map(item => item.id)).size !== ids.length || result.results.some(item => !ids.includes(item.id))) throw new Error("Read result identity changed.")
      const fields = [...(input.personFields ?? ["title"])].sort()
      if (result.results.some(item => "kind" in item && item.kind === "person" && JSON.stringify(item.contactFields) !== JSON.stringify(fields))) throw new Error("Contact read scope changed.")
    } else {
      const input = knowledgeSearchSchema.parse(args)
      if (result.results.some(item => !("kind" in item) || !input.kinds.includes(item.kind))) throw new Error("Search result scope changed.")
      if (knowledgeSearchResultSchema.parse(result).unavailableKinds.some(kind => !input.kinds.includes(kind))) throw new Error("Search availability scope changed.")
    }
  }
  return result
}
export const unavailableKnowledgeToolResult = { version: 1, status: "unavailable", recovery: "retry_read",
  error: "This authorized source or tool could not be verified. Retry the read; do not infer its contents." } as const

/** Descriptors for the existing enabled tool entries, derived from the same
 * schemas enforced by their handlers. Registration never grants source access. */
const readContract = { version: RESEARCH_CONTRACT_VERSION, effect: "internal_read", authority: "current_actor_source_access",
  disclosure: "configured_private_model_only", replay: "fresh_authorization_required", cancellation: "stage_fences_and_abortable_read_signals",
  sourceTimeoutMs: 10000, runDeadlineMs: 90000, providerRequestUtf8Bytes: 20000, maxToolCallsPerRun: 8,
  approval: "existing_research_admission_and_current_source_access", receipt: "run_dependency_manifest_and_evidence",
  correlation: "validated_provider_tool_call_id", errors: "typed_non_enumerating_availability_and_recovery",
  logging: "permitted_run_metadata_without_source_bodies", spend: "existing_quoted_run_ceiling" } as const
const exampleEnvelope = { version: 1, scope: { organizationId: "11111111-1111-4111-8111-111111111111", canvasId: null }, effect: "internal_read",
  disclosure: { destination: "configured_workspace_model", sensitivity: "organization_private", publicDisclosure: false } } as const
export const knowledgeToolDescriptors = [
  { ...readContract, name: "search_workspace", description: "Search authorized workspace records for compact excerpts and IDs. Narrow kinds and query. People search includes names/roles only. Results describe partial coverage and safe recovery; content is supplied to the configured planning model.",
    inputSchema: knowledgeSearchSchema, providerInputSchema: knowledgeSearchSchema, outputSchema: knowledgeSearchResultSchema,
    maxResults: 8, maxConcurrentSources: 6, bodyUtf16Characters: 3840, perResultUtf16Characters: 480,
    example: { query: "community partners", kinds: ["person"] },
    outputExample: { ...exampleEnvelope, results: [], unavailableKinds: [], limit: 8, note: "No matches in the requested authorized scope." } },
  { ...readContract, name: "read_workspace", description: "Read up to four known authorized references; search only if IDs are unknown. personFields selects needed contact fields; null defaults to name/role, never all routes or notes. Other kinds ignore personFields. Availability/recovery and selected fields are server-derived. Excerpts/DOCX body are partial scope; never infer missing contents or new permission.",
    inputSchema: knowledgeReadSchema, providerInputSchema: knowledgeProviderReadSchema, outputSchema: knowledgeReadResultSchema,
    maxResults: 4, maxConcurrentSources: 4, bodyUtf16Characters: 6000,
    example: { ids: ["person:known-reference"], personFields: ["email"] },
    outputExample: { ...exampleEnvelope, results: [{ id: "person:known-reference", status: "unavailable", recovery: "retry_read", error: "Contents could not be verified. Retry the read; do not infer their contents." }] } },
] as const
