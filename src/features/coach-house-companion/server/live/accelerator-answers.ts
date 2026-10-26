import sanitizeHtml from "sanitize-html"
import { decodeHtmlEntities } from "@/lib/markdown/convert"
import { isAssignmentFieldAnswered } from "@/lib/modules/assignment-completion"
import type { ModuleAssignmentField } from "@/lib/modules/types"
import { CompanionError } from "../errors"

export function liveInvalid(message: string): never { throw new CompanionError("invalid_arguments", 400, message) }
export function livePlainText(value: unknown, max = 12000): string {
  if (typeof value !== "string" || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) liveInvalid("Use bounded plain text without control characters.")
  let text = value.replace(/\r\n?/g, "\n")
  for (let pass = 0; pass < 6; pass++) {
    const normalized = decodeHtmlEntities(sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} })).trim()
    if (normalized === text) return text
    text = normalized
  }
  return liveInvalid("Use plain text without nested encoded markup.")
}
export function liveRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
export function validateLiveAnswers(fields: ModuleAssignmentField[], raw: unknown, submitting = false) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || JSON.stringify(raw).length > 80000) liveInvalid("Answers must be a bounded object.")
  const supplied = raw as Record<string, unknown>
  const known = new Map(fields.filter(field => field.type !== "subtitle").map(field => [field.name, field]))
  const answers: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(supplied)) {
    const field = known.get(name)
    if (!field || ["__proto__", "constructor", "prototype"].includes(name)) liveInvalid("Unknown assignment question.")
    if (value === null) { answers[name] = null; continue }
    switch (field.type) {
      case "short_text": case "long_text": case "custom_program":
        answers[name] = livePlainText(value, 12000); break
      case "select": {
        const selected = livePlainText(value, 1000)
        if (selected && field.options?.length && !field.options.includes(selected)) liveInvalid("Choose an available option.")
        answers[name] = selected; break
      }
      case "multi_select":
        if (!Array.isArray(value) || value.length > 100) liveInvalid("Choose a bounded list of options.")
        answers[name] = [...new Set(value.map(item => {
          const selected = livePlainText(item, 1000)
          if (!selected || (field.options?.length && !field.options.includes(selected))) liveInvalid("Choose available options.")
          return selected
        }))]; break
      case "slider": {
        const min = field.min ?? 0, max = field.max ?? min + 100, step = field.step ?? 1
        if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || Math.abs((value - min) / step - Math.round((value - min) / step)) > 1e-8) liveInvalid("Use a number in the question's range and step.")
        answers[name] = value; break
      }
      case "budget_table": {
        if (!Array.isArray(value) || value.length > 100) liveInvalid("Budget answers must be a bounded row list.")
        const keys = ["category", "description", "costType", "unit", "units", "costPerUnit", "totalCost"]
        answers[name] = value.map(row => {
          const record = liveRecord(row)
          if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(record).some(key => !keys.includes(key))) liveInvalid("Use the published budget table columns.")
          return Object.fromEntries(keys.map(key => [key, livePlainText(record[key] ?? "", 2000)]))
        }); break
      }
    }
  }
  if (submitting && fields.some(field => field.required && field.type !== "subtitle" && !isAssignmentFieldAnswered(field, answers))) liveInvalid("Answer every required question before submitting.")
  return answers
}
