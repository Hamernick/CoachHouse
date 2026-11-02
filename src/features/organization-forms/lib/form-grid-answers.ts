import type { FormSnapshotQuestion } from "./form-version"
import { formGridAnswerSchema } from "./form-grid-schema"

type GridQuestion = Extract<FormSnapshotQuestion, { type: "multiple_choice_grid" | "checkbox_grid" }>
/** Shape is checked before this semantic, immutable-version membership check. */
export function validateGridAnswer(question: GridQuestion, input: unknown): string | null {
  const parsed = formGridAnswerSchema.safeParse(input)
  if (!parsed.success) return "Choose answers for the grid rows."
  const value = parsed.data
  if (Object.keys(value).some(id => !question.rows.some(row => row.id === id))) return "An answer refers to an unavailable row."
  for (const row of question.rows) {
    const selected = value[row.id]
    if (selected === undefined) {
      if (question.required) return `Answer ${row.label}.`
      continue
    }
    if (question.type === "multiple_choice_grid" ? typeof selected !== "string" : !Array.isArray(selected)) return "Use the expected grid answer type."
    const ids = typeof selected === "string" ? [selected] : selected
    if (new Set(ids).size !== ids.length || ids.some(id => !question.columns.some(column => column.id === id))) return "Choose distinct available columns."
    if (question.required && !ids.length) return `Answer ${row.label}.`
  }
  return null
}
export function displayGridAnswer(question: GridQuestion, input: unknown): string {
  const parsed = formGridAnswerSchema.safeParse(input)
  if (!parsed.success) return "Unavailable answer"
  const value = parsed.data
  return question.rows.map(row => {
    const selected = value[row.id]
    const ids = typeof selected === "string" ? [selected] : selected ?? []
    return `${row.label}: ${ids.map(id => question.columns.find(column => column.id === id)?.label ?? "Unavailable choice").join(", ") || "No answer"}`
  }).join("\n")
}
