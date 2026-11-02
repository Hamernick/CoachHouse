import { describe, expect, it } from "vitest"
import { createFormVersion, formDefinitionSchema, formVersionSchema, validateFormAnswers, changeFormQuestionType, duplicateFormQuestion, type FormDefinition } from "@/features/organization-forms"
import { displayChoiceAnswer, FORM_OTHER_TEXT_LIMIT } from "@/features/organization-forms/lib/form-other-answer"
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const definition: FormDefinition = { questions: [{ id: id(1), type: "single_choice", label: "Location", required: true, options: ["North", "South"], allowOther: true }] }
const makeVersion = (definition: FormDefinition) => createFormVersion({ id: id(2), formId: id(3), revision: 1, title: "Choices", description: "", definition })
const version = makeVersion(definition)
const other = { optionIds: ["other"], otherText: " East " }
const validate = (value: unknown, snapshot = version.definition) => validateFormAnswers(snapshot, [{ questionId: id(1), value }])

describe("version-bound Other answers", () => {
  it("preserves legacy choice schemas and answers without enabling Other", () => {
    const legacy = structuredClone(definition); const q = legacy.questions[0]
    if ("allowOther" in q) delete q.allowOther
    const old = makeVersion(legacy)
    expect(old.definition.questions[0]).not.toHaveProperty("allowOther")
    expect(validate("option-1", old.definition).ok).toBe(true)
    expect(validate(other, old.definition).ok).toBe(false)
    expect(formVersionSchema.parse(JSON.parse(JSON.stringify(old)))).toEqual(old)
  })
  it("stores a distinct reserved choice identity and bounded trimmed text, independent of labels", () => {
    const result = validate(other)
    expect(result).toEqual({ ok: true, answers: [{ questionId: id(1), value: { optionIds: ["other"], otherText: "East" } }] })
    const q = version.definition.questions[0]
    if (!("options" in q)) throw new Error("Choice expected")
    expect(displayChoiceAnswer(q, other)).toBe("Other:  East ")
    const changed = structuredClone(definition)
    const draft = changed.questions[0]
    if (draft.type === "single_choice" || draft.type === "multiple_choice") { draft.options.reverse(); draft.allowOther = false }
    expect(validate(other).ok).toBe(true)
    expect(validate(other, makeVersion(changed).definition).ok).toBe(false)
    expect(Object.isFrozen(q)).toBe(true)
  })
  it.each([
    "other", ["other"], { optionIds: ["other"], otherText: "  " },
    { optionIds: ["other"], otherText: "x".repeat(FORM_OTHER_TEXT_LIMIT + 1) },
    { optionIds: ["other", "option-1"], otherText: "East" },
    { optionIds: ["other", "other"], otherText: "East" },
    { optionIds: ["option-1"], otherText: "Hidden" },
    { optionIds: ["other"], otherText: "East", permission: "write" },
  ])("rejects invalid single choice or hidden text %j", value => expect(validate(value).ok).toBe(false))
  it("allows regular checkbox choices plus Other, but rejects duplicates and foreign IDs", () => {
    const checkbox = makeVersion({ questions: [changeFormQuestionType(definition.questions[0], "multiple_choice")] })
    const value = { optionIds: ["option-1", "other"], otherText: "East" }
    expect(validate(value, checkbox.definition).ok).toBe(true)
    expect(validate(["option-1", "option-2"], checkbox.definition).ok).toBe(true)
    expect(validate({ ...value, optionIds: ["other", "option-3"] }, checkbox.definition).ok).toBe(false)
    expect(validate({ ...value, optionIds: ["other", "option-1", "option-1"] }, checkbox.definition).ok).toBe(false)
    const q = checkbox.definition.questions[0]
    if (!("options" in q)) throw new Error("Choice expected")
    expect(displayChoiceAnswer(q, value)).toBe("North, Other: East")
  })
  it("retains compatible settings through duplicate/type conversion and excludes dropdowns", () => {
    const copied = duplicateFormQuestion(definition, id(1), id(4))
    expect(copied.questions[1]).toEqual({ ...definition.questions[0], id: id(4) })
    const checkbox = changeFormQuestionType(definition.questions[0], "multiple_choice")
    expect(checkbox).toHaveProperty("allowOther", true)
    const dropdown = changeFormQuestionType(checkbox, "dropdown")
    expect(dropdown).not.toHaveProperty("allowOther")
    expect(formDefinitionSchema.safeParse({ questions: [{ ...dropdown, allowOther: true }] }).success).toBe(false)
    expect(validate(other, makeVersion({ questions: [dropdown] }).definition).ok).toBe(false)
  })
  it("requires text whenever Other is selected even on an optional question and counts it toward the total bound", () => {
    const optional = makeVersion({ questions: [{ ...definition.questions[0], required: false }] })
    expect(validate("", optional.definition)).toEqual({ ok: true, answers: [] })
    expect(validate({ ...other, otherText: "" }, optional.definition).ok).toBe(false)
    const questions = Array.from({ length: 30 }, (_, index) => ({ ...definition.questions[0], id: id(index + 10) }))
    const large = makeVersion({ questions })
    expect(validateFormAnswers(large.definition, questions.map(q => ({ questionId: q.id, value: { ...other, otherText: "x".repeat(2000) } }))).ok).toBe(false)
  })
})
