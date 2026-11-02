import { z } from "zod"
import type { FormSnapshotQuestion } from "./form-version"

/** Reserved identity scoped to the immutable version and question, never a label. */
export const FORM_OTHER_ID = "other"
export const FORM_OTHER_TEXT_LIMIT = 2_000
export const formOtherAnswerSchema = z.strictObject({
  optionIds: z.array(z.string().regex(/^(?:other|option-([1-9]|[1-4][0-9]|50))$/)).min(1).max(51),
  otherText: z.string().max(FORM_OTHER_TEXT_LIMIT),
})
export type FormOtherAnswer = z.infer<typeof formOtherAnswerSchema>
export function isFormOtherAnswer(value: unknown): value is FormOtherAnswer {
  return formOtherAnswerSchema.safeParse(value).success
}
export function validateOtherAnswer(question: FormSnapshotQuestion, value: unknown): string | null {
  if ((question.type !== "single_choice" && question.type !== "multiple_choice") || !question.allowOther || !isFormOtherAnswer(value))
    return "Choose one of the available options."
  const ids = value.optionIds
  if (!ids.includes(FORM_OTHER_ID) || new Set(ids).size !== ids.length ||
    (question.type === "single_choice" && ids.length !== 1) ||
    ids.some(id => id !== FORM_OTHER_ID && !question.options.some(option => option.id === id)))
    return "Choose distinct available options."
  return value.otherText.trim() ? null : "Describe your other answer."
}
export function displayChoiceAnswer(question: Extract<FormSnapshotQuestion, { type: "single_choice" | "multiple_choice" | "dropdown" }>, value: unknown): string {
  const other = isFormOtherAnswer(value) ? value : null
  const ids = other ? other.optionIds : Array.isArray(value) ? value : [value]
  return ids.map(id => id === FORM_OTHER_ID && other ? `Other: ${other.otherText}` : question.options.find(option => option.id === id)?.label ?? "Unavailable choice").join(", ")
}
