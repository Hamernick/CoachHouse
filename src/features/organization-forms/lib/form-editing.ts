import type { FormDefinition, FormQuestion, FormQuestionType } from "../types"
export function createFormQuestion(id: string): FormQuestion {
  return { id, type: "text", label: "", required: false }
}
export function changeFormQuestionType(
  question: FormQuestion,
  type: FormQuestionType
): FormQuestion {
  const common = {
    id: question.id,
    label: question.label,
    required: question.required,
  }
  return type === "single_choice" || type === "multiple_choice"
    ? {
        ...common,
        type,
        options:
          "options" in question ? question.options : ["Option 1", "Option 2"],
      }
    : { ...common, type }
}
export function moveFormQuestion(
  definition: FormDefinition,
  id: string,
  direction: -1 | 1
): FormDefinition {
  const questions = [...definition.questions]
  const index = questions.findIndex((q) => q.id === id),
    next = index + direction
  if (index < 0 || next < 0 || next >= questions.length) return definition
  ;[questions[index], questions[next]] = [questions[next], questions[index]]
  return { ...definition, questions }
}
