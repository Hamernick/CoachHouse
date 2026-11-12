import { z } from "zod"
import { RESEARCH_CONTRACT_VERSION } from "./research-skills"
import { knowledgePersonFieldsSchema } from "./knowledge-person-fields"
import { knowledgeSearchSchema, knowledgeProviderSearchSchema, knowledgeReadSchema, knowledgeProviderReadSchema, knowledgeEvidenceSchema, knowledgeKindSchema, researchSourceSchema } from "../research-types"
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
  if (value.evidence.pdf && !value.id.startsWith("file:")) return false
  if (value.evidence.tableAnalysis && ((value.evidence.tableAnalysis.csv ? value.kind !== "document" || !value.id.startsWith("file:") : value.kind !== "particle") || value.evidence.tableAnalysis.request.id !== value.id || value.evidence.coverage !== "complete" || !value.evidence.readAt || value.truncated || !value.contentAvailable)) return false
  if (JSON.stringify(value.contactFields) !== JSON.stringify(value.evidence.contactFields)) return false
  if (value.contentAvailable !== ["available", "truncated"].includes(value.status)) return false
  if (value.status === "available" && (value.truncated || value.evidence.coverage !== "complete")) return false
  if (value.status === "truncated" && (!value.truncated || value.evidence.coverage !== "excerpt")) return false
  if (!value.contentAvailable && value.evidence.coverage !== (value.status === "metadata_only" ? "metadata_only" : "unavailable")) return false
  if (value.evidence.textCoverage) {
    const coverage = value.evidence.textCoverage, location = value.evidence.location
    if (!/^(?:document|file):/.test(value.id)) return false
    if (value.contentAvailable && (coverage.complete !== (value.evidence.coverage === "complete") ||
      coverage.ranges.length !== (value.content.length ? 1 : 0) ||
      (value.content.length && (!location || coverage.ranges[0].start !== location.start || coverage.ranges[0].end !== location.end)))) return false
  }
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
  pdfWindow: z.strictObject({id:z.string().regex(/^file:.+/).max(200),evidence:knowledgeEvidenceSchema})
    .refine(value => Boolean(value.evidence.pdf) && !value.evidence.pdf?.priorWindows && value.evidence.coverage === "metadata_only" &&
      value.evidence.characters === 0 && value.evidence.readAt === null && value.evidence.pdf?.pages.length === 0 &&
      value.evidence.textCoverage?.ranges.length === 0 && !value.evidence.textCoverage.complete, "Invalid PDF search coverage").optional(),
  uploads: z.strictObject({ scope: z.enum(["title_matches","library"]), candidates: z.number().int().min(0).max(20),
    attempted: z.number().int().min(0).max(5), read: z.number().int().min(0).max(5), unread: z.number().int().min(0).max(20),
    pending: z.number().int().min(0).max(20), unreadPriorPages: z.number().int().min(0).max(160), continuation: z.uuid().nullable(), nextPage: z.uuid().nullable() }).refine(value =>
    value.read <= value.attempted && value.attempted <= value.candidates && value.unread <= value.candidates &&
    value.pending <= value.unread && (!value.pending || value.continuation !== null) && (!value.nextPage || value.continuation !== null), "Inconsistent upload coverage").optional(),
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
      if (input.tableAnalysis && (ids.length !== 1 || ids[0] !== input.tableAnalysis.id || input.documentRanges?.length || input.personFields)) throw new Error("Table analysis scope changed.")
      for (const item of result.results) if ("evidence" in item) {
        if (JSON.stringify(item.evidence.tableAnalysis?.request ?? null) !== JSON.stringify(input.tableAnalysis ?? null)) throw new Error("Table analysis scope changed.")
      }
      const ranges = input.documentRanges ?? []
      if (new Set(ranges.map(range => range.id)).size !== ranges.length || ranges.some(range => !ids.includes(range.id))) throw new Error("Read range scope changed.")
      for (const item of result.results) {
        const range = ranges.find(range => range.id === item.id)
        if ("evidence" in item && item.evidence.pdf && (item.evidence.pdf.startPage ?? 1) !== (range?.pdfStartPage ?? 1)) throw new Error("PDF window scope changed.")
        if (!("evidence" in item) || !item.contentAvailable || !item.evidence.textCoverage) continue
        if (range?.pdfStartPage && !item.evidence.pdf) throw new Error("PDF window scope changed.")
        if (range && (!item.evidence.location || (item.evidence.location.start !== range.start && !(item.id.startsWith("file:") && item.evidence.location.start === range.start + 1)) || item.evidence.location.end > range.end)) throw new Error("Read range scope changed.")
      }
      const fields = [...(input.personFields ?? ["title"])].sort()
      if (result.results.some(item => "kind" in item && item.kind === "person" && JSON.stringify(item.contactFields) !== JSON.stringify(fields))) throw new Error("Contact read scope changed.")
    } else {
      const input = knowledgeSearchSchema.parse(args)
      if (result.results.some(item => !("kind" in item) || !input.kinds.includes(item.kind))) throw new Error("Search result scope changed.")
      if (knowledgeSearchResultSchema.parse(result).unavailableKinds.some(kind => !input.kinds.includes(kind))) throw new Error("Search availability scope changed.")
      const searchResult = knowledgeSearchResultSchema.parse(result)
      if (input.pdfWindow) {
        const window = input.pdfWindow
        if (input.kinds.length !== 1 || input.kinds[0] !== "document" || input.uploadCursor || input.documentMode === "hybrid" || searchResult.uploads ||
          (searchResult.unavailableKinds.length ? searchResult.results.length || searchResult.pdfWindow : !searchResult.pdfWindow) ||
          (searchResult.pdfWindow && (searchResult.pdfWindow.id !== window.id || (searchResult.pdfWindow.evidence.pdf?.startPage ?? 1) !== window.startPage)) ||
          searchResult.results.some(item => item.id !== window.id || !item.evidence.pdf || (item.evidence.pdf.startPage ?? 1) !== window.startPage ||
            item.evidence.pdf.totalPages !== searchResult.pdfWindow?.evidence.pdf?.totalPages ||
            item.evidence.pdf.processedPages !== searchResult.pdfWindow?.evidence.pdf?.processedPages ||
            JSON.stringify(item.evidence.pdf.unreadPages) !== JSON.stringify(searchResult.pdfWindow?.evidence.pdf?.unreadPages)))
          throw new Error("PDF search window scope changed.")
      } else if (searchResult.pdfWindow) throw new Error("PDF search window scope changed.")
      if (searchResult.uploads && (!input.kinds.includes("document") || searchResult.unavailableKinds.includes("document"))) throw new Error("Upload coverage scope changed.")
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
export const tableAnalysisToolDescription = " tableAnalysis (default null): exact budget/actual/actual_minus_budget over one complete saved filter or CSV, intersected with period YYYY-MM. One source/declaration/run; max500 rows,1MB (CSV256KB). Declare distinct numeric budget/actual and text/select currency/period columns, amountUnit major, currency USD/EUR/GBP/CAD/AUD; two decimals, no FX/coercion. compareToPeriod: null or earlier YYYY-MM; both months need rows, returns selected_minus_comparison differences, no percentages. groupByColumn: null or distinct text/select column; grouping requires compareToPeriod null. Max20 exact-label groups; NFC labels1–120 chars without edge whitespace/control/format characters. Missing/ambiguous/unknown-select labels or overflow refuse all totals; no case merging or Other bucket. Sheets: exact saved range, formula results, display-value filter, hidden rows included. CSV: complete UTF-8 comma file, first record headers, column_N=header position N, plain decimal amounts, no formula evaluation/import. Failed/partial/stale reads give no totals."
export const knowledgeToolDescriptors = [
  { ...readContract, name: "search_workspace", description: "pdfWindow:null=library; {id,startPage}=one PDF window (physical start,40 pages/200k chars/2MiB). Only kinds:[document],documentMode:keyword/null,uploadCursor:null. Read offsets with same pdfStartPage. Uploads:5 files/20 rows,titles then library; cursor=continuation or nextPage skips unread. Same query/kinds/mode,single-use/run. Native:keyword/hybrid/null. Passages:9600/200k chars/source,not exhaustive. People:names/roles.",
    inputSchema: knowledgeSearchSchema, providerInputSchema: knowledgeProviderSearchSchema, outputSchema: knowledgeSearchResultSchema,
    maxResults: 8, maxConcurrentSources: 6, bodyUtf16Characters: 3840, perResultUtf16Characters: 480,
    example: { query: "community partners", kinds: ["person"], documentMode: null },
    outputExample: { ...exampleEnvelope, results: [], unavailableKinds: [], limit: 8, note: "No matches in the requested authorized scope." } },
  { ...readContract, name: "read_workspace", description: "Read ≤4 authorized IDs; search unknown IDs. personFields:null=name/role only. documentRanges: one UTF-16 start/end per native/TXT/MD/DOCX/PDF ID/call, max6000 chars; cap200,000. Null starts0. CRLF→LF; DOCX body only. PDF:2MiB,40 pages/window; pdfStartPage selects physical start (null=1), offsets restart0 there. pdf.pages=touched; unreadPages=no text; outside window unread. No OCR/images/forms/layout. textCoverage is inspected intervals, never whole-document proof",
    inputSchema: knowledgeReadSchema, providerInputSchema: knowledgeProviderReadSchema, outputSchema: knowledgeReadResultSchema,
    maxResults: 4, maxConcurrentSources: 4, bodyUtf16Characters: 6000,
    example: { ids: ["person:known-reference"], personFields: ["email"] },
    outputExample: { ...exampleEnvelope, results: [{ id: "person:known-reference", status: "unavailable", recovery: "retry_read", error: "Contents could not be verified. Retry the read; do not infer their contents." }] } },
] as const
