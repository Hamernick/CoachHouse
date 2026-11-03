import "server-only"
import { z } from "zod"

const schemaFields = new Set([
  "title", "summary", "questions", "unfulfilled", "decisions", "removeReferences", "items",
  "key", "itemKey", "outcomes", "label", "next", "kind", "description", "referenceId",
  "evidenceIds", "dependsOn", "form", "dataView",
])
const issueCodes = new Set([
  "invalid_type", "too_big", "too_small", "invalid_format", "not_multiple_of",
  "unrecognized_keys", "invalid_union", "invalid_key", "invalid_element", "invalid_value", "custom",
])

/** Never include Zod messages, values, unknown keys or nested union errors. */
export function researchFormatDiagnostic(error: unknown, format: "json" | "schema") {
  if (format === "json" || !(error instanceof z.ZodError)) return { format }
  return {
    format,
    issues: error.issues.slice(0, 6).map(issue => ({
      code: issueCodes.has(issue.code) ? issue.code : "unknown",
      // Numeric indices are unnecessary for diagnosis; model-selected record keys
      // and fields outside this fixed vocabulary must not enter application logs.
      path: issue.path.slice(0, 6).map(segment =>
        typeof segment === "number" ? "[]" : typeof segment === "string" && schemaFields.has(segment) ? segment : "[field]"),
    })),
  }
}
