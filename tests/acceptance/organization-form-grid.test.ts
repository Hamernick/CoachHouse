import { describe, expect, it } from "vitest"
import { changeFormQuestionType, createFormVersion, formDefinitionSchema, formVersionSchema, publishedFormDefinitionSchema, validateFormAnswers, duplicateFormQuestion, type FormDefinition } from "@/features/organization-forms"
import { displayGridAnswer } from "@/features/organization-forms/lib/form-grid-answers"

const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const question = { id: id(1), type: "multiple_choice_grid" as const, label: "Availability", required: true,
  rows: [{ id: id(10), label: "Monday" }, { id: id(11), label: "Tuesday" }],
  columns: [{ id: id(20), label: "Morning" }, { id: id(21), label: "Afternoon" }] }
const definition: FormDefinition = { questions: [question] }
const version = createFormVersion({ id: id(3), formId: id(4), revision: 1, title: "Availability", description: "", definition })
const check = (value: unknown) => validateFormAnswers(version.definition, [{ questionId: id(1), value }])

describe("grid contracts", () => {
  it("preserves axis identities and saved labels across renames, reordering and duplication", () => {
    const draft = formDefinitionSchema.parse(JSON.parse(JSON.stringify(definition)))
    const grid = draft.questions[0]; if (!("rows" in grid)) throw new Error("Expected grid")
    grid.rows.reverse(); grid.rows[0].label = "Changed"; grid.columns.reverse()
    expect(formDefinitionSchema.parse(JSON.parse(JSON.stringify(draft)))).toEqual(draft)
    expect(formVersionSchema.parse(JSON.parse(JSON.stringify(version)))).toEqual(version)
    const saved = version.definition.questions[0]; if (!("rows" in saved)) throw new Error("Expected grid")
    expect(displayGridAnswer(saved, { [id(10)]: id(20), [id(11)]: id(21) })).toBe("Monday: Morning\nTuesday: Afternoon")
    const copy = duplicateFormQuestion(draft, id(1), id(2))
    const copied = copy.questions[1]; if (!("rows" in copied)) throw new Error("Expected grid")
    copied.rows[0].label = "Copy"; expect(grid.rows[0].label).toBe("Changed")
    expect(check({ [id(10)]: id(20), [id(11)]: id(21) }).ok).toBe(true)
    expect(Object.isFrozen(saved.rows[0])).toBe(true)
  })
  it.each([{}, { [id(10)]: id(20) }, { [id(10)]: id(20), [id(11)]: id(99) }, { [id(10)]: id(20), [id(11)]: id(21), [id(99)]: id(20) }, { [id(10)]: [id(20)], [id(11)]: id(21) }, "Morning", []])("rejects incomplete or foreign rows/columns and wrong shapes %j", value => {
    expect(check(value).ok).toBe(false)
  })
  it("supports optional sparse grids and validates every required checkbox row", () => {
    const multi = changeFormQuestionType(question, "checkbox_grid")
    const snapshot = createFormVersion({ ...version, definition: { questions: [multi] } }).definition
    expect(validateFormAnswers(snapshot, [{ questionId: id(1), value: { [id(10)]: [id(20), id(21)], [id(11)]: [id(20)] } }]).ok).toBe(true)
    for (const value of [{ [id(10)]: [id(20), id(20)], [id(11)]: [id(20)] }, { [id(10)]: [id(20)], [id(11)]: [] }, { [id(10)]: id(20), [id(11)]: [id(21)] }]) {
      expect(validateFormAnswers(snapshot, [{ questionId: id(1), value }]).ok).toBe(false)
    }
    const optional = createFormVersion({ ...version, definition: { questions: [{ ...multi, required: false }] } }).definition
    expect(validateFormAnswers(optional, [{ questionId: id(1), value: {} }])).toEqual({ ok: true, answers: [] })
    expect(validateFormAnswers(optional, [{ questionId: id(1), value: { [id(10)]: [id(20)] } }]).ok).toBe(true)
  })
  it("requires unique stable IDs even in drafts, and complete distinct axis labels at publication", () => {
    for (const patch of [{ rows: [question.rows[0], question.rows[0]] }, { columns: [question.columns[0], question.columns[0]] }, { rows: Array.from({ length: 21 }, (_, n) => ({ id: id(100 + n), label: `${n}` })) }, { columns: Array.from({ length: 11 }, (_, n) => ({ id: id(100 + n), label: `${n}` })) }]) {
      expect(formDefinitionSchema.safeParse({ questions: [{ ...question, ...patch }] }).success).toBe(false)
    }
    for (const patch of [{ rows: [] }, { columns: [question.columns[0]] }, { rows: [{ ...question.rows[0], label: " " }] }, { columns: [question.columns[0], { ...question.columns[1], label: " morning " }] }]) {
      expect(formDefinitionSchema.safeParse({ questions: [{ ...question, ...patch }] }).success).toBe(true)
      expect(publishedFormDefinitionSchema.safeParse({ questions: [{ ...question, ...patch }] }).success).toBe(false)
    }
  })
  it("keeps row/column IDs through explicit grid type changes and rejects old choices in a new snapshot", () => {
    const multi = changeFormQuestionType(question, "checkbox_grid")
    expect(multi).toMatchObject({ rows: question.rows, columns: question.columns, id: question.id })
    const changed = createFormVersion({ ...version, id: id(5), revision: 2, definition: { questions: [{ ...question, columns: [{ id: id(22), label: "Evening" }, question.columns[1]] }] } })
    expect(validateFormAnswers(changed.definition, [{ questionId: id(1), value: { [id(10)]: id(20), [id(11)]: id(21) } }]).ok).toBe(false)
    expect(check({ [id(10)]: id(20), [id(11)]: id(21) }).ok).toBe(true)
  })
  it("counts grid answer characters toward the existing total payload budget", () => {
    const large = Array.from({ length: 20 }, (_, n) => ({ id: id(100 + n), label: `Row ${n}` }))
    const columns = Array.from({ length: 10 }, (_, n) => ({ id: id(200 + n), label: `Column ${n}` }))
    const questions = Array.from({ length: 8 }, (_, n) => ({ ...question, type: "checkbox_grid" as const, id: id(300 + n), rows: large, columns }))
    const snapshot = createFormVersion({ ...version, definition: { questions } }).definition
    const value = Object.fromEntries(large.map(row => [row.id, columns.map(col => col.id)]))
    expect(validateFormAnswers(snapshot, questions.map(q => ({ questionId: q.id, value })))).toMatchObject({ ok: false, issues: [{ message: "Answers exceed the total form limit." }] })
  })
})
