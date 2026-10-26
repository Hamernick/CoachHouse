import { createHash, randomUUID } from "node:crypto"
import sanitizeHtml from "sanitize-html"
import { shouldTreatAssignmentSubmissionAsComplete } from "@/lib/modules/assignment-completion"
import { decodeHtmlEntities } from "@/lib/markdown/convert"
import type { CompanionPrincipal, CompanionToolArguments, CompanionToolName, CompanionToolResult } from "../types"
import { companionAssignmentFields } from "../lib/lesson"
import { buildCompanionCalendarExport } from "../lib/calendar"
import { CompanionError } from "./errors"
import { withCompanionSession, type CompanionSessionRecord } from "./store"

export { CompanionError } from "./errors"
export { createCompanionSession, revokeCompanionSession } from "./store"

const tools = new Set<CompanionToolName>(["companion_get_session", "companion_save_draft", "companion_save_document", "companion_submit_assignment", "companion_schedule_block"])
const fields = new Set(companionAssignmentFields.map((field) => field.name))
const MAX_REQUESTS = 256

function invalid(message: string): never { throw new CompanionError("invalid_arguments", 400, message) }
function text(value: unknown, limit: number, label: string) {
  if (typeof value !== "string" || value.length > limit) return invalid(`${label} must be text of at most ${limit} characters.`)
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return invalid(`${label} contains invalid control characters.`)
  // The transport carries plain text; render it as text, never innerHTML.
  return decodeHtmlEntities(sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })).trim()
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null"
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`
}

function validateArguments(name: CompanionToolName, args: CompanionToolArguments) {
  if (!args || typeof args !== "object" || Array.isArray(args)) invalid("Tool arguments must be an object.")
  const extras: Record<CompanionToolName, string[]> = {
    companion_get_session: [], companion_save_draft: ["expectedRevision", "answers"],
    companion_save_document: ["expectedRevision", "content", "confirmed"],
    companion_submit_assignment: ["expectedRevision", "confirmed"],
    companion_schedule_block: ["title", "startsAt", "endsAt", "timeZone", "confirmed"],
  }
  const allowed = new Set(["organizationId", ...(name === "companion_get_session" ? [] : ["requestId"]), ...extras[name]])
  if (Object.keys(args).some((key) => !allowed.has(key))) invalid("Unknown tool argument.")
  if (typeof args.organizationId !== "string" || args.organizationId.length > 100) invalid("An organization ID is required.")
  if (name === "companion_get_session") return
  if (typeof args.requestId !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(args.requestId)) invalid("A unique requestId of 8–100 letters, digits, underscores or hyphens is required.")
  if (["__proto__", "constructor", "prototype"].includes(args.requestId)) invalid("Use a unique random request ID.")
  if (name !== "companion_schedule_block" && (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision! < 0)) invalid("A nonnegative expectedRevision is required.")
  if (name !== "companion_save_draft" && args.confirmed !== true) throw new CompanionError("confirmation_required", 400, "Review the exact change and confirm before saving.")
  if (args.answers !== undefined) {
    if (!args.answers || typeof args.answers !== "object" || Array.isArray(args.answers)) invalid("Answers must be an object.")
    if (Object.keys(args.answers).length > fields.size) invalid("Too many answer fields.")
    for (const [key, value] of Object.entries(args.answers)) {
      if (!fields.has(key)) invalid("Unknown assignment field.")
      text(value, 4000, "Answer")
    }
  }
  for (const [key, limit] of [["content", 12000], ["title", 180], ["startsAt", 40], ["endsAt", 40], ["timeZone", 80]] as const) {
    if (args[key] !== undefined) text(args[key], limit, key)
  }
}

function requireRevision(expected: number | undefined, actual: number) {
  if (expected !== actual) throw new CompanionError("revision_conflict", 409, "This work changed elsewhere. Reload and review before saving.")
}

function applyChange(record: CompanionSessionRecord, name: CompanionToolName, args: CompanionToolArguments) {
  const snapshot = record.snapshot
  const now = new Date().toISOString()
  let message: string
  switch (name) {
    case "companion_save_draft": {
      requireRevision(args.expectedRevision, snapshot.draft.revision)
      if (args.answers === undefined) invalid("Answers are required.")
      const answers = Object.fromEntries(Object.entries(args.answers).map(([key, value]) => [key, text(value, 4000, "Answer")]))
      snapshot.draft = { answers: { ...snapshot.draft.answers, ...answers }, revision: snapshot.draft.revision + 1, updatedAt: now }
      message = "Draft saved in this sandbox. Nothing was submitted or published."
      break
    }
    case "companion_save_document": {
      requireRevision(args.expectedRevision, snapshot.document.revision)
      const content = text(args.content, 12000, "Document")
      if (!content) invalid("The document cannot be empty.")
      snapshot.document = { ...snapshot.document, content, revision: snapshot.document.revision + 1 }
      message = "Mission statement saved in this sandbox. Your public organization profile was not changed."
      break
    }
    case "companion_submit_assignment": {
      requireRevision(args.expectedRevision, snapshot.draft.revision)
      record.submissionAnswers = { ...snapshot.draft.answers }
      const completed = shouldTreatAssignmentSubmissionAsComplete({
        completeOnSubmit: snapshot.lesson.completeOnSubmit, completionMode: "all_answered",
        fields: companionAssignmentFields, answers: record.submissionAnswers, status: "submitted",
      })
      snapshot.submission = { status: "submitted", completed, submittedAt: now }
      message = completed ? "Assignment submitted and lesson completed in this sandbox." : "Assignment submitted in this sandbox. The lesson remains incomplete until all questions are answered and resubmitted."
      break
    }
    case "companion_schedule_block": {
      try {
        snapshot.calendar.event = buildCompanionCalendarExport({
          id: randomUUID(), title: text(args.title, 180, "Title"), startsAt: text(args.startsAt, 40, "Start"),
          endsAt: text(args.endsAt, 40, "End"), timeZone: text(args.timeZone, 80, "Timezone"), now,
        })
      } catch (error) { invalid(error instanceof Error ? error.message : "Invalid calendar event.") }
      message = "Calendar file prepared. Import it to add the work block; no event was created in Google Calendar."
      break
    }
    default: return invalid("Unsupported write tool.")
  }
  snapshot.receipts = [...snapshot.receipts.slice(-19), { id: randomUUID(), action: name, at: now, message }]
  return message
}

export async function executeCompanionTool(principal: CompanionPrincipal, name: CompanionToolName, args: CompanionToolArguments): Promise<CompanionToolResult> {
  if (!tools.has(name)) throw new CompanionError("unknown_tool", 400, "Unknown companion tool.")
  validateArguments(name, args)
  if (!principal || principal.organizationId !== args.organizationId) throw new CompanionError("forbidden", 403, "This organization is not available to this session.")
  return withCompanionSession(principal, (record) => {
    if (name === "companion_get_session") return { snapshot: record.snapshot, message: "Sandbox session loaded. No live organization or calendar is connected." }
    const fingerprint = createHash("sha256").update(canonical({ name, args })).digest("hex")
    const existing = Object.prototype.hasOwnProperty.call(record.requests, args.requestId!) ? record.requests[args.requestId!] : undefined
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new CompanionError("idempotency_conflict", 409, "This request ID was already used for a different change.")
      return { snapshot: record.snapshot, message: `Already applied. ${existing.message}` }
    }
    if (Object.keys(record.requests).length >= MAX_REQUESTS) throw new CompanionError("session_limit", 429, "This sandbox session reached its change limit. Start a new session.")
    const message = applyChange(record, name, args)
    record.requests[args.requestId!] = { fingerprint, message }
    return { snapshot: record.snapshot, message }
  }, name !== "companion_get_session")
}
