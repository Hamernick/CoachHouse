import { describe, expect, it } from "vitest"
import { changeFormQuestionType, createFormVersion, formDefinitionSchema, formVersionSchema, validateFormAnswers, type FormDefinition } from "@/features/organization-forms"

const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const definition: FormDefinition = { questions: [
  { id: id(1), type: "linear_scale", label: "Confidence", required: true, min: 0, max: 10, lowerLabel: "Low", upperLabel: "High" },
  { id: id(2), type: "rating", label: "Experience", required: false, min: 1, max: 5, lowerLabel: "Poor", upperLabel: "Excellent" },
] }
const version = createFormVersion({ id: id(3), formId: id(4), revision: 1, title: "Feedback", description: "", definition })

describe("scale and rating contracts", () => {
  it("preserves saved bounds and endpoint labels independently of later drafts", () => {
    const draft = formDefinitionSchema.parse(JSON.parse(JSON.stringify(definition)))
    expect(draft).toEqual(definition)
    draft.questions[0] = { ...definition.questions[1], id: id(1) }
    expect(formVersionSchema.parse(JSON.parse(JSON.stringify(version)))).toEqual(version)
    expect(version.definition.questions[0]).toMatchObject({ type: "linear_scale", min: 0, max: 10, lowerLabel: "Low" })
    expect(validateFormAnswers(version.definition, [{ questionId: id(1), value: 0 }]).ok).toBe(true)
    expect(validateFormAnswers(version.definition, [{ questionId: id(1), value: 10 }, { questionId: id(2), value: 5 }]).ok).toBe(true)
  })
  it.each([-1, 11, 1.5, "3", [], ["3"], null])("rejects invalid scale answer %j", value => {
    expect(validateFormAnswers(version.definition, [{ questionId: id(1), value }]).ok).toBe(false)
  })
  it("distinguishes zero from missing and allows clearing only optional answers", () => {
    expect(validateFormAnswers(version.definition, []).ok).toBe(false)
    expect(validateFormAnswers(version.definition, [{ questionId: id(1), value: "" }]).ok).toBe(false)
    expect(validateFormAnswers(version.definition, [{ questionId: id(1), value: 0 }, { questionId: id(2), value: "" }])).toEqual({ ok: true, answers: [{ questionId: id(1), value: 0 }] })
    for (const value of [0, 6, 2.5, "5"]) expect(validateFormAnswers(version.definition, [{ questionId: id(1), value: 0 }, { questionId: id(2), value }]).ok).toBe(false)
  })
  it("rejects unsupported bounds and retains compatible settings during explicit type changes", () => {
    for (const patch of [{ min: -1 }, { min: 2 }, { max: 11 }, { max: 1 }, { max: 3.5 }, { lowerLabel: "x".repeat(121) }]) {
      const invalid = { questions: [{ ...definition.questions[0], ...patch }] }
      expect(formDefinitionSchema.safeParse(invalid).success).toBe(false)
    }
    const rating = changeFormQuestionType(definition.questions[0], "rating")
    expect(rating).toMatchObject({ min: 1, max: 10, lowerLabel: "Low", upperLabel: "High", id: id(1) })
    expect(changeFormQuestionType(rating, "linear_scale")).toMatchObject({ min: 1, max: 10, lowerLabel: "Low" })
    expect(changeFormQuestionType(rating, "text")).toEqual({ id: id(1), type: "text", label: "Confidence", required: true })
    expect(formDefinitionSchema.safeParse({ questions: [{ ...rating, min: 0 }] }).success).toBe(false)
  })
})
