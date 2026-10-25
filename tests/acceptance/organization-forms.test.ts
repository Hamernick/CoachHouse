import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import {
  formDefinitionSchema,
  publishedFormDefinitionSchema,
  createFormQuestion,
  changeFormQuestionType,
  moveFormQuestion,
} from "@/features/organization-forms"
import { OrganizationFormBuilder } from "@/features/organization-forms/client"
import { WorkspaceFileTable } from "@/components/workspace/workspace-file-table"
import {
  buildParticlePreset,
  DEFAULT_PRESET_FIELDS,
  PARTICLE_PRESETS,
} from "@/features/workspace-particles/lib/particle-presets"
import { applyParticleBatch } from "@/features/workspace-particles"
import { particleCreationConflict } from "@/features/workspace-particles/lib/particle-event"
import { ParticleCard } from "@/features/workspace-particles/components/particle-card"
import { ParticleFormPreview } from "@/features/workspace-particles/components/particle-form-preview"
import { ParticleWorkFields } from "@/features/workspace-particles/components/particle-work-fields"
import { ID, NOW, WORKSPACE, batch, graph } from "./fixtures/particle-fixtures"

const question = { ...createFormQuestion(ID(801)), label: "Your name" }
const definition = { questions: [question] }
function formParticle() {
  const preset = PARTICLE_PRESETS.find((preset) => preset.id === "form")
  if (!preset) throw new Error("Missing Form preset")
  return buildParticlePreset(preset, {
    id: ID(800),
    workspaceId: WORKSPACE,
    now: NOW,
    title: "Volunteer intake",
    description: "",
    fields: DEFAULT_PRESET_FIELDS,
    form: definition,
  })
}

describe("organization form drafts", () => {
  it("identifies Form particles separately from their activity storage type", () => {
    const html = renderToStaticMarkup(createElement(ParticleCard, {
      controls: false,
      data: { particle: formParticle(), editable: false, onOpen: vi.fn(), onEdit: vi.fn() },
    }))
    expect(html).toContain('data-particle-kind="form"')
    expect(html).toContain(`data-particle-id="${ID(800)}"`)
    expect(html).toContain('data-particle-title="Volunteer intake"')
    expect(html).toContain('data-particle-storage-type="activity"')
    expect(html).toContain(`workspace-particle:form:${ID(800)}:`)
    expect(html).toContain("Your name")
    expect(html).toContain("Short answer")
    expect(html).toContain(">View</button>")
    expect(html).not.toContain(">Edit</button>")
  })
  it("renders an honest empty preview without fake questions or response controls", () => {
    const html = renderToStaticMarkup(createElement(ParticleFormPreview, { definition: { questions: [] } }))
    expect(html).toContain("Create a custom form")
    expect(html).not.toContain("<input")
    expect(html).not.toContain("Submit")
  })
  it("permits incomplete private drafts but rejects publishing them", () => {
    const blank = { questions: [createFormQuestion(ID(802))] }
    expect(formDefinitionSchema.safeParse(blank).success).toBe(true)
    expect(publishedFormDefinitionSchema.safeParse(blank).success).toBe(false)
    expect(
      publishedFormDefinitionSchema.safeParse({ questions: [] }).success
    ).toBe(false)
    expect(publishedFormDefinitionSchema.safeParse(definition).success).toBe(
      true
    )
  })
  it("requires unique IDs and bounds question/option counts", () => {
    expect(
      formDefinitionSchema.safeParse({ questions: [question, question] })
        .success
    ).toBe(false)
    expect(
      formDefinitionSchema.safeParse({
        questions: Array.from({ length: 51 }, (_, i) =>
          createFormQuestion(ID(900 + i))
        ),
      }).success
    ).toBe(false)
    const choice = changeFormQuestionType(question, "single_choice")
    expect(
      formDefinitionSchema.safeParse({
        questions: [{ ...choice, options: Array(51).fill("Option") }],
      }).success
    ).toBe(false)
  })
  it("preserves identity and required state when changing question types", () => {
    const choice = changeFormQuestionType(
      { ...question, required: true },
      "single_choice"
    )
    expect(choice).toMatchObject({
      id: question.id,
      label: question.label,
      required: true,
      options: ["Option 1", "Option 2"],
    })
    expect(changeFormQuestionType(choice, "multiple_choice")).toMatchObject({
      options: ["Option 1", "Option 2"],
    })
    expect(changeFormQuestionType(choice, "email")).toEqual({
      id: question.id,
      label: question.label,
      required: true,
      type: "email",
    })
  })
  it.each([["Yes"], ["Yes", " yes "], ["Yes", ""], [" ", "No"]])(
    "rejects incomplete or duplicate choice options %j on publish",
    (...options) => {
      const choice = { ...question, type: "single_choice", options }
      expect(
        publishedFormDefinitionSchema.safeParse({ questions: [choice] }).success
      ).toBe(false)
    }
  )
  it("reorders by identity without mutating the saved draft", () => {
    const original = { questions: [question, createFormQuestion(ID(803))] }
    const moved = moveFormQuestion(original, ID(803), -1)
    expect(moved.questions.map((q) => q.id)).toEqual([ID(803), question.id])
    expect(original.questions[0]).toBe(question)
    expect(moveFormQuestion(original, question.id, -1)).toBe(original)
  })
  it("persists the definition in the existing atomic graph and supports its inverse", async () => {
    const particle = formParticle()
    const added = await applyParticleBatch(
      graph(),
      batch(810, [{ kind: "put_particle", particle, expectedRevision: null }]),
      NOW
    )
    expect(added.ok).toBe(true)
    if (!added.ok) throw new Error(added.error)
    expect(
      added.value.graph.particles.find((p) => p.id === particle.id)
    ).toMatchObject({ data: { widget: { kind: "form", definition } } })
    const undone = await applyParticleBatch(
      added.value.graph,
      batch(811, added.value.inverse),
      NOW
    )
    expect(
      undone.ok &&
        undone.value.graph.particles.some((p) => p.id === particle.id)
    ).toBe(false)
  })
  it("retains changed form drafts instead of confirming an older creation receipt", () => {
    const original = formParticle()
    if (original.type !== "activity" || original.data.widget?.kind !== "form")
      throw new Error("Expected form")
    const changedQuestions = {
      ...original,
      data: {
        ...original.data,
        widget: {
          ...original.data.widget,
          definition: { questions: [{ ...question, label: "Email instead" }] },
        },
      },
    }
    for (const edited of [
      { ...original, title: "Different title" },
      { ...original, description: "Different description" },
      changedQuestions,
    ]) {
      expect(particleCreationConflict(edited, original, null)).toContain(
        "already added with different content"
      )
      expect(
        particleCreationConflict(
          edited,
          undefined,
          batch(812, [
            {
              kind: "put_particle",
              particle: original,
              expectedRevision: null,
            },
          ])
        )
      ).toContain("earlier placement is unconfirmed")
    }
    expect(particleCreationConflict(original, original, null)).toBeNull()
  })
  it("does not add an unrelated checklist to a form", () => {
    const html = renderToStaticMarkup(
      createElement(ParticleWorkFields, {
        draft: formParticle(),
        editable: true,
        setDraft: vi.fn(),
      })
    )
    expect(html).not.toContain("Checklist")
    expect(html).not.toContain("Add step")
  })
  it("renders editable question rows and one Add before them, without publishing controls", () => {
    const onChange = vi.fn()
    const html = renderToStaticMarkup(
      createElement(OrganizationFormBuilder, { definition, onChange })
    )
    expect(html.indexOf("Add question")).toBeLessThan(html.indexOf("Your name"))
    expect(html).toContain('value="Your name"')
    expect(html).toContain("Short answer")
    expect(html).not.toContain("Private draft ·")
    expect(html).not.toContain("Add your first question.")
    expect(html).not.toContain('href="/forms/')
    expect(onChange).not.toHaveBeenCalled()
  })
  it("locks edits in read-only contexts and caps adding at 50 questions", () => {
    const html = renderToStaticMarkup(
      createElement(OrganizationFormBuilder, {
        definition,
        disabled: true,
        onChange: vi.fn(),
      })
    )
    for (const input of html.matchAll(/<input\b[^>]*>/g))
      expect(input[0]).toContain('disabled=""')
    const full = {
      questions: Array.from({ length: 50 }, (_, i) =>
        createFormQuestion(ID(900 + i))
      ),
    }
    const capped = renderToStaticMarkup(
      createElement(OrganizationFormBuilder, {
        definition: full,
        onChange: vi.fn(),
      })
    )
    expect(capped.match(/<button\b[^>]*>/)?.[0]).toContain('disabled=""')
  })
})

describe("workspace CSV table", () => {
  it("keeps headings visible, renders text safely and preserves ragged/duplicate columns", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceFileTable, {
        title: "responses.csv",
        rows: [
          ["Name", "Name"],
          ["<script>bad()</script>", "002", "extra"],
        ],
      })
    )
    expect(html).toContain("<thead")
    expect(html).toContain('scope="col"')
    expect(html).toContain("Column 3")
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<script>bad()")
    expect(html).toContain("002")
    expect(html).toContain("extra")
  })
  it("renders at most a page of rows and provides navigation", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceFileTable, {
        title: "large.csv",
        rows: [
          ["Heading"],
          ...Array.from({ length: 1000 }, (_, i) => [`Record ${i}`]),
        ],
        compact: true,
      })
    )
    expect(html).toContain("Record 4")
    expect(html).not.toContain("Record 5<")
    expect(html).toContain("Previous")
    expect(html).toContain("Next")
    expect(html).toContain("1 / 200")
  })
})
