import { formResponsePageSchema } from "./form-intake"
import { validateFormAnswers } from "./form-answers"
import { displayChoiceAnswer } from "./form-other-answer"
import { displayGridAnswer } from "./form-grid-answers"
import type { FormAnswer } from "./form-answers"
import type { FormSnapshotQuestion } from "./form-version"

/** One authorized response page, never an implied full-dataset export. */
export const FORM_RESPONSE_EXPORT_LIMIT = 16 * 1024 * 1024
export class FormResponseExportSizeError extends Error {}

function cell(value: string | number): string {
  // Quote every cell and neutralize spreadsheet formulas in untrusted text,
  // including headers and whitespace/control-prefixed values. Numbers stay numeric.
  const text = String(value)
  const safe = typeof value === "string" && /^[\s\u0000-\u001f]*[=+@-]/u.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}
function answer(question: FormSnapshotQuestion, value: FormAnswer["value"] | undefined): string | number {
  if (value === undefined) return ""
  if ("rows" in question) return displayGridAnswer(question, value)
  if ("options" in question) return displayChoiceAnswer(question, value)
  return typeof value === "number" ? value : String(value)
}

export function exportFormResponsePage(input: unknown, versionId: string): string {
  const page = formResponsePageSchema.parse(input)
  if (page.version.id !== versionId || new Set(page.responses.map(row => row.id)).size !== page.responses.length)
    throw new Error("Invalid export identity")
  const questions = page.version.definition.questions
  const encoder = new TextEncoder(); const chunks = ["\ufeff"]; let bytes = 3
  function append(row: (string | number)[]) {
    const line = `${row.map(cell).join(",")}\r\n`
    bytes += encoder.encode(line).byteLength
    if (bytes > FORM_RESPONSE_EXPORT_LIMIT) throw new FormResponseExportSizeError("Export too large")
    chunks.push(line)
  }
  append(["Response ID", "Version ID", "Revision", "Submitted at (UTC)", "Updated at (UTC)",
    ...questions.map(question => `${question.label} [${question.id}]`)])
  for (const response of page.responses) {
    if (response.versionId !== versionId || !validateFormAnswers(page.version.definition, response.answers).ok)
      throw new Error("Invalid export response")
    append([response.id, versionId, response.revision, new Date(response.submittedAt).toISOString(), new Date(response.updatedAt).toISOString(),
      ...questions.map(question => answer(question, response.answers.find(value => value.questionId === question.id)?.value))])
  }
  // BOM supports UTF-8 spreadsheet import. CRLF and escaped quotes preserve multiline answers.
  return chunks.join("")
}
