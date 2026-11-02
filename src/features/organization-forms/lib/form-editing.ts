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
  if (type === "multiple_choice_grid" || type === "checkbox_grid") {
    return { ...common, type,
      rows: "rows" in question ? question.rows : [1, 2].map(n => ({ id: crypto.randomUUID(), label: `Row ${n}` })),
      columns: "columns" in question ? question.columns : [1, 2].map(n => ({ id: crypto.randomUUID(), label: `Column ${n}` })),
    }
  }
  if (type === "linear_scale" || type === "rating") {
    const scale = "max" in question ? question : null
    const settings = { ...common, max: scale?.max ?? 5, lowerLabel: scale?.lowerLabel ?? "", upperLabel: scale?.upperLabel ?? "" }
    return type === "rating" ? { ...settings, type, min: 1 } : { ...settings, type, min: scale?.min ?? 0 }
  }
  return type === "single_choice" || type === "multiple_choice" || type === "dropdown"
    ? {
        ...common,
        type,
        ...(type !== "dropdown" && "allowOther" in question ? { allowOther: question.allowOther } : {}),
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

/** Moves an existing question without changing its identity or answers. */
export function reorderFormQuestion(definition: FormDefinition, id: string, targetId: string): FormDefinition {
  const from = definition.questions.findIndex(question => question.id === id)
  const to = definition.questions.findIndex(question => question.id === targetId)
  if (from < 0 || to < 0 || from === to) return definition
  const questions = [...definition.questions]
  questions.splice(to, 0, questions.splice(from, 1)[0])
  return { ...definition, questions }
}

/** Copies only the definition; a fresh identity cannot inherit an answer. */
export function duplicateFormQuestion(definition: FormDefinition, id: string, newId: string): FormDefinition {
  const index = definition.questions.findIndex(question => question.id === id)
  if (index < 0 || definition.questions.length >= 50 || definition.questions.some(question => question.id === newId)) return definition
  const copy = { ...structuredClone(definition.questions[index]), id: newId }
  const questions = [...definition.questions]
  questions.splice(index + 1, 0, copy)
  return { ...definition, questions }
}
