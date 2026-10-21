import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import {
  createFormSnapshot,
  createFormVersion,
  formSnapshotSchema,
  formVersionSchema,
  validateFormAnswers,
  validateFormSubmission,
  normalizeFormAnswerInputs,
  type FormDefinition,
} from "@/features/organization-forms"
import { OrganizationFormPreview } from "@/features/organization-forms/components/organization-form-preview"
import { OrganizationFormAnswerField } from "@/features/organization-forms/components/organization-form-answer-field"
import { OrganizationFormBuilder } from "@/features/organization-forms/client"
import { ID } from "./fixtures/particle-fixtures"

const definition: FormDefinition = {
  questions: [
    { id: ID(901), type: "text", label: "Name", required: true },
    { id: ID(902), type: "paragraph", label: "Notes", required: false },
    { id: ID(903), type: "email", label: "Email", required: true },
    { id: ID(904), type: "number", label: "Guests", required: true },
    {
      id: ID(905),
      type: "single_choice",
      label: "Shift",
      required: true,
      options: ["Morning", "Evening"],
    },
    {
      id: ID(906),
      type: "multiple_choice",
      label: "Skills",
      required: false,
      options: ["Cooking", "Driving"],
    },
  ],
}
const snapshot = createFormSnapshot(definition)
const valid = [
  { questionId: ID(901), value: "  Alex  " },
  { questionId: ID(903), value: "alex@example.org" },
  { questionId: ID(904), value: 0 },
  { questionId: ID(905), value: "option-2" },
]
const versionInput = {
  id: ID(910),
  formId: ID(911),
  revision: 1,
  title: "Volunteer intake",
  description: "Join us",
  definition,
}
const version = createFormVersion(versionInput)

describe("form version and answer boundary", () => {
  it("detaches and deeply freezes snapshots without freezing or altering the editable draft", () => {
    const draft = structuredClone(definition)
    const saved = createFormVersion({ ...versionInput, definition: draft })
    draft.questions[0].label = "Renamed"
    const choice = draft.questions[4]
    if (!("options" in choice)) throw new Error("Expected choice")
    choice.options.reverse()
    expect(saved.definition.questions[0].label).toBe("Name")
    expect(saved.definition.questions[4]).toMatchObject({
      options: [
        { id: "option-1", label: "Morning" },
        { id: "option-2", label: "Evening" },
      ],
    })
    expect(Object.isFrozen(draft)).toBe(false)
    expect(Object.isFrozen(saved)).toBe(true)
    expect(Object.isFrozen(saved.definition.questions)).toBe(true)
    expect(Object.isFrozen(saved.definition.questions[0])).toBe(true)
    const savedChoice = saved.definition.questions[4]
    if (!("options" in savedChoice)) throw new Error("Expected choice")
    expect(Object.isFrozen(savedChoice.options)).toBe(true)
    expect(Object.isFrozen(savedChoice.options[0])).toBe(true)
  })
  it("rejects unfinished definitions, blank titles and private metadata in public version records", () => {
    expect(() =>
      createFormVersion({ ...versionInput, definition: { questions: [] } })
    ).toThrow()
    expect(() => createFormVersion({ ...versionInput, title: " " })).toThrow()
    expect(
      formVersionSchema.safeParse({ ...version, organizationId: ID(999) })
        .success
    ).toBe(false)
    expect(
      formVersionSchema.safeParse({ ...version, revision: 1.5 }).success
    ).toBe(false)
  })
  it("rejects repeated question IDs and ambiguous choice IDs/labels", () => {
    const choice = snapshot.questions[4]
    if (!("options" in choice)) throw new Error("Expected choice")
    for (const options of [
      [choice.options[0], { ...choice.options[1], id: choice.options[0].id }],
      [choice.options[0], { ...choice.options[1], label: " morning " }],
    ])
      expect(
        formSnapshotSchema.safeParse({ questions: [{ ...choice, options }] })
          .success
      ).toBe(false)
    expect(
      formSnapshotSchema.safeParse({
        questions: [snapshot.questions[0], snapshot.questions[0]],
      }).success
    ).toBe(false)
  })
  it("accepts typed values, preserves zero and normalizes whitespace without altering input", () => {
    expect(validateFormAnswers(snapshot, valid)).toEqual({
      ok: true,
      answers: valid.map((answer) =>
        answer.questionId === ID(901) ? { ...answer, value: "Alex" } : answer
      ),
    })
    expect(valid[0].value).toBe("  Alex  ")
  })
  it("reports every missing required question without requiring optional answers", () => {
    expect(validateFormAnswers(snapshot, [])).toMatchObject({
      ok: false,
      issues: [
        { questionId: ID(901) },
        { questionId: ID(903) },
        { questionId: ID(904) },
        { questionId: ID(905) },
      ],
    })
    expect(
      validateFormAnswers(snapshot, [
        ...valid,
        { questionId: ID(902), value: " " },
        { questionId: ID(906), value: [] },
      ])
    ).toMatchObject({
      ok: true,
      answers: expect.arrayContaining([{ questionId: ID(904), value: 0 }]),
    })
  })
  it.each([
    [ID(901), ["option-1"]],
    [ID(901), []],
    [ID(903), "not-an-email"],
    [ID(904), ""],
    [ID(904), "4"],
    [ID(904), false],
    [ID(904), Infinity],
    [ID(905), "Evening"],
    [ID(905), "option-3"],
    [ID(905), ["option-1"]],
    [ID(906), ["option-1", "option-1"]],
    [ID(906), ["option-51"]],
    [ID(901), "x".repeat(2001)],
    [ID(902), "x".repeat(10001)],
  ])("rejects invalid value for %s", (questionId, value) => {
    expect(
      validateFormAnswers(snapshot, [
        ...valid.filter((answer) => answer.questionId !== questionId),
        { questionId, value },
      ]).ok
    ).toBe(false)
  })
  it("rejects unknown IDs, duplicate answers, extra properties and unbounded payloads", () => {
    for (const answers of [
      [...valid, valid[0]],
      [...valid, { questionId: ID(999), value: "Injected" }],
      [{ ...valid[0], userId: ID(999) }, ...valid.slice(1)],
      Array(51).fill(valid[0]),
    ])
      expect(validateFormAnswers(snapshot, answers).ok).toBe(false)
    const large = createFormSnapshot({
      questions: Array.from({ length: 6 }, (_, i) => ({
        id: ID(950 + i),
        label: `Question ${i}`,
        required: false,
        type: "paragraph",
      })),
    })
    expect(
      validateFormAnswers(
        large,
        large.questions.map((question) => ({
          questionId: question.id,
          value: "x".repeat(10000),
        }))
      ).ok
    ).toBe(false)
  })
  it("does not reinterpret an old response against a changed form or version", () => {
    const submission = {
      id: ID(912),
      formId: version.formId,
      versionId: version.id,
      answers: valid,
    }
    expect(validateFormSubmission(version, submission).ok).toBe(true)
    expect(
      validateFormSubmission(version, { ...submission, formId: ID(999) }).ok
    ).toBe(false)
    expect(
      validateFormSubmission(version, { ...submission, versionId: ID(999) }).ok
    ).toBe(false)
    expect(
      validateFormSubmission(version, { ...submission, accepted: true }).ok
    ).toBe(false)
    const changed = createFormVersion({
      ...versionInput,
      id: ID(913),
      revision: 2,
    })
    expect(validateFormSubmission(changed, submission).ok).toBe(false)
  })
  it.each([
    [" 0 ", 0],
    ["-.5", -0.5],
    ["1.", 1],
    ["", ""],
    ["1e3", "1e3"],
    ["0x10", "0x10"],
    ["1,200", "1,200"],
    ["abc", "abc"],
  ])("normalizes decimal draft %j only when requested", (value, expected) => {
    const input = [{ questionId: ID(904), value }]
    expect(normalizeFormAnswerInputs(snapshot, input)[0].value).toBe(expected)
    expect(input[0].value).toBe(value)
  })
})

describe("local form preview", () => {
  it("renders all question types with explicit preview semantics and no nested form or submit button", () => {
    const html = renderToStaticMarkup(
      createElement(OrganizationFormPreview, { snapshot })
    )
    expect(html).toContain('aria-label="Form preview"')
    expect(html).toContain("Preview answers aren’t saved.")
    expect(html).toContain('inputMode="email"')
    expect(html).not.toContain('type="email"')
    expect(html).toContain('inputMode="decimal"')
    expect(html).toContain("<textarea")
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('role="checkbox"')
    expect(html).toContain("Check answers")
    expect(html).not.toContain("<form")
    expect(html).not.toContain('type="submit"')
    expect(html).not.toContain("Nothing was submitted.")
  })
  it("associates inline errors and required state with the actual field", () => {
    const html = renderToStaticMarkup(
      createElement(OrganizationFormAnswerField, {
        question: snapshot.questions[0],
        id: "answer-name",
        value: "",
        error: "This question is required.",
        onChange: vi.fn(),
      })
    )
    expect(html).toContain('for="answer-name"')
    expect(html).toContain('aria-describedby="answer-name-error"')
    expect(html).toContain('id="answer-name-error"')
    expect(html).toContain('aria-required="true"')
    expect(html).toContain('aria-invalid="true"')
  })
  it("accepts header-controlled preview without duplicating its button or changing the draft", () => {
    const onChange = vi.fn()
    const html = renderToStaticMarkup(createElement(OrganizationFormBuilder, {
      definition, onChange, preview: true, showPreviewControl: false,
    }))
    expect(html).toContain("Check answers")
    expect(html).not.toContain('aria-pressed=')
    expect(onChange).not.toHaveBeenCalled()
  })
  it("offers Preview without changing the controlled draft on render", () => {
    const onChange = vi.fn()
    const html = renderToStaticMarkup(
      createElement(OrganizationFormBuilder, { definition, onChange })
    )
    expect(html).toContain("Preview")
    expect(html).toContain('aria-pressed="false"')
    expect(onChange).not.toHaveBeenCalled()
  })
})
