import { Step } from "@tiptap/pm/transform"
import { documentSchema, validateDocument } from "./schema"
import { toPlainDocumentJson } from "./serialization"
import type { DocumentSession } from "../types"

export function applyDocumentSteps(session: DocumentSession, steps: Record<string, unknown>[], clientId: string) {
  if (steps.length > 200) throw new Error("Too many edits in one request. Retry in smaller batches.")
  let document = documentSchema.nodeFromJSON(session.document)
  validateDocument(document)
  for (const json of steps) {
    const result = Step.fromJSON(documentSchema, json).apply(document)
    if (result.failed || !result.doc) throw new Error("Unable to apply these edits safely.")
    document = result.doc
  }
  validateDocument(document)
  if (document.content.size > 250_000) throw new Error("Document is too large.")
  const journal = [...session.steps, ...steps.map(step => ({ step, clientId }))].slice(-2000)
  let journalBytes = journal.reduce((total, entry) => total + JSON.stringify(entry).length, 0)
  while (journal.length > steps.length && journalBytes > 2_000_000) {
    journalBytes -= JSON.stringify(journal.shift()).length
  }
  return { ...session, document: toPlainDocumentJson(document.toJSON()), version: session.version + steps.length,
    steps: journal }
}
