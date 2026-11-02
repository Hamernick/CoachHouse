import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ID, WORKSPACE, NOW, graph, particle } from "./fixtures/particle-fixtures"
import { formDefinitionSchema, type FormDefinition } from "@/features/organization-forms"
import { bindResearch } from "@/features/workspace-ai/lib/research-contract"
import { createResearchDraft, applyResearchDraft, validateResearchRecoveryDraft } from "@/features/workspace-ai/lib/research-draft"
import { researchDraftCheckpointSchema } from "@/features/workspace-ai/lib/research-draft-checkpoint"
import { researchResultSchema, providerResearchSchema, providerFormResearchSchema, type ResearchResult } from "@/features/workspace-ai/research-types"
import { projectResearchPresentation, projectIncomingResearchPresentation } from "@/features/workspace-ai/lib/research-presentation"
import { ResearchPlanPresentation } from "@/features/workspace-ai/components/research-presentation"
import { ResearchDraftEditor } from "@/features/workspace-ai/components/research-draft-editor"
import { ResearchReview } from "@/features/workspace-ai/components/research-review"
import { createResearchItemParser } from "@/features/workspace-ai/lib/research-item-preview"
import { createResearchItemProgress } from "@/features/workspace-ai/server/research-item-progress"
import { researchProviderRequest, researchRequestFits } from "@/features/workspace-ai/server/research-provider-request"
import { researchPrompt } from "@/features/workspace-ai/server/research-prompt"
import { researchFormOutputsEnabled } from "@/features/workspace-ai/server/research-output-config"
import { researchPlanOperations } from "@/features/workspace-particles/lib/research-plan"
import { buildParticlePreset, PARTICLE_PRESETS as particlePresets, DEFAULT_PRESET_FIELDS } from "@/features/workspace-particles/lib/particle-presets"
import { bindParticleSource, particleRegistry } from "@/features/workspace-particles/lib/particle-registry"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { prepareAuthorizedParticleMutation } from "@/features/workspace-particles/lib/authorized-mutation"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import { researchContextFingerprint } from "@/features/workspace-ai/server/research-dependencies"
import type { ResponseTextDeltaEvent } from "openai/resources/responses/responses"

const mocks = vi.hoisted(() => ({ context: vi.fn(), read: vi.fn(), load: vi.fn() }))
vi.mock("@/features/workspace-ai/server/research-context", () => ({ loadResearchContext: mocks.context }))
vi.mock("@/features/ai-credits", () => ({ readAiRun: mocks.read }))
vi.mock("@/features/workspace-ai/server/knowledge-records", () => ({ knowledgeLoader: () => mocks.load }))
import { prepareResearchApplication } from "@/features/workspace-ai/server/research-application"

const definition = (): FormDefinition => ({ questions: [
  { id: ID(30), type: "text", label: "Your name", required: true },
  { id: ID(31), type: "email", label: "Contact email", required: false },
  { id: ID(32), type: "single_choice", label: "Preferred day", options: ["Friday", "Saturday"], allowOther: false, required: true },
] })
const result = (): ResearchResult => ({
  title: "Event signup", summary: "Prepare a private interest form", questions: [], unfulfilled: [], decisions: [], removeReferences: [], sources: [],
  runId: ID(8), target: { organizationId: WORKSPACE, objectiveId: ID(1), revision: 0 },
  items: [{ key: "signup", title: "Event interest form", description: "Review before publishing.", kind: "form", form: definition(), referenceId: null, evidenceIds: [], dependsOn: [] }],
})
const before = graph([particle(1, "objective")])
const context = { user: { id: ID(90) }, graph: before, objective: before.particles[0], canvasId: null, target: result().target } as ResearchContext
const input = { runId: ID(8), organizationId: WORKSPACE, objectiveId: ID(1) }
const config = { tariff: { version: "fixture", model: "fixture", inputMicrodollarsPerMillion: 1, cachedMicrodollarsPerMillion: 0, outputMicrodollarsPerMillion: 1, webSearchMicrodollarsPerCall: 0, microdollarsPerCredit: 2000 }, maxRounds: 3, maxSearchCalls: 0, maxInputBytes: 20000, maxOutputTokens: 1500, maxCredits: 20, maxCost: 40000 }
function enable() { vi.stubEnv("WORKSPACE_AI_FORM_OUTPUTS", "1"); vi.stubEnv("NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION", "1") }
function generated(value = result()) {
  const { target: _target, runId: _runId, sources: _sources, ...output } = value
  return output
}
function saved(value = result()) {
  return { id: value.runId, status: "succeeded", target: { ...value.target, kind: "particle_research", userId: ID(90), canvasId: null },
    proposal: JSON.stringify({ ...value, dependencies: { version: 1, contextFingerprint: researchContextFingerprint(context), records: [] } }), charged_credits: 2, cancel_requested_at: null }
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("WORKSPACE_AI_FORM_OUTPUTS", ""); vi.stubEnv("NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION", ""); mocks.context.mockResolvedValue(context); mocks.read.mockResolvedValue(saved()); mocks.load.mockResolvedValue([]) })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe("private form working outputs", () => {
  it("requires both opt-ins and rejects saved forms while disabled", async () => {
    expect(researchFormOutputsEnabled()).toBe(false)
    vi.stubEnv("WORKSPACE_AI_FORM_OUTPUTS", "1")
    expect(researchFormOutputsEnabled()).toBe(false)
    await expect(prepareResearchApplication(input)).rejects.toThrow(/not enabled/)
    enable(); expect((await prepareResearchApplication(input)).batch).not.toBeNull()
  })
  it("derives provider forms from the canonical schema and excludes them from the default provider contract", () => {
    expect(providerResearchSchema.safeParse(generated()).success).toBe(false)
    expect(providerFormResearchSchema.parse(generated()).items[0].form).toEqual(definition())
    const base = researchProviderRequest(config, [{ role: "user", content: researchPrompt(context, { prompt: "Prepare event signup", skill: "planning", target: result().target }) }])
    expect(JSON.stringify(base.text)).not.toContain('"form"')
    enable()
    const enabled = researchProviderRequest(config, [{ role: "user", content: researchPrompt(context, { prompt: "Prepare event signup", skill: "planning", target: result().target }) }])
    expect(JSON.stringify(enabled.text)).toContain('"form"')
    expect(enabled.instructions).toContain("actual private form-definition drafts")
    expect(researchRequestFits(enabled, config.maxInputBytes)).toBe(true)
    expect(enabled.store).toBe(false)
    expect(enabled.max_output_tokens).toBe(base.max_output_tokens)
  })
  it.each(["missing", "duplicate", "upload", "unknown", "oversized", "not_form"])("rejects %s payloads without degrading a form to a note", problem => {
    const value = generated()
    if (problem === "missing") value.items[0].form = null
    if (problem === "duplicate") value.items[0].form!.questions.push(value.items[0].form!.questions[0])
    if (problem === "upload") Reflect.set(value.items[0].form!.questions[0], "type", "file_upload")
    if (problem === "unknown") Reflect.set(value.items[0].form!, "publish", true)
    if (problem === "oversized") value.items[0].form!.questions = Array.from({ length: 51 }, (_, n) => ({ ...definition().questions[0], id: ID(300 + n) }))
    if (problem === "not_form") value.items[0].kind = "note"
    expect(() => bindResearch(JSON.stringify(value), [], result().target, ID(8))).toThrow()
  })
  it("retains all thirteen canonical question types without lossy provider conversion", () => {
    const questions: FormDefinition["questions"] = [
      ...["text", "paragraph", "email", "number", "date", "time"].map((type, n) => ({ id: ID(400 + n), type, label: `Question ${n}`, required: false })),
      ...["single_choice", "multiple_choice", "dropdown"].map((type, n) => ({ id: ID(410 + n), type, label: `Choice ${n}`, required: true, options: ["One", "Two"], ...(type === "dropdown" ? {} : { allowOther: false }) })),
      { id: ID(420), type: "linear_scale", label: "Scale", required: false, min: 0, max: 5, lowerLabel: "Low", upperLabel: "High" },
      { id: ID(421), type: "rating", label: "Rating", required: false, min: 1, max: 5, lowerLabel: "Low", upperLabel: "High" },
      ...["multiple_choice_grid", "checkbox_grid"].map((type, n) => ({ id: ID(430 + n), type, label: `Grid ${n}`, required: false,
        rows: [{ id: ID(440 + n), label: "First row" }], columns: [{ id: ID(450 + n), label: "Yes" }, { id: ID(460 + n), label: "No" }] })),
    ] as FormDefinition["questions"]
    const value = generated(); value.items[0].form = { questions }
    const parsed = providerFormResearchSchema.parse(value)
    expect(parsed.items[0].form).toEqual(formDefinitionSchema.parse({ questions }))
    expect(bindResearch(JSON.stringify(parsed), [], result().target, ID(8)).items[0].form).toEqual({ questions })
  })
  it("renders the actual canonical form and editor without publication, intake or provider effects", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch)
    const original = result(), copy = structuredClone(original)
    const preview = renderToStaticMarkup(createElement(ResearchPlanPresentation, { result: original }))
    expect(preview).toContain("Your name"); expect(preview).toContain("Contact email"); expect(preview).toContain("Preferred day")
    expect(preview).toContain("Friday"); expect(preview).toContain("Saturday")
    expect(preview).toContain("Preview answers aren’t saved")
    const editor = renderToStaticMarkup(createElement(ResearchDraftEditor, { result: original, draft: createResearchDraft(original), disabled: false, onChange: vi.fn() }))
    expect(editor).toContain('aria-label="Form questions"')
    expect(editor).toContain("Your name")
    expect(original).toEqual(copy); expect(fetch).not.toHaveBeenCalled()
    expect(renderToStaticMarkup(createElement(ResearchReview, { result: original }))).toContain("Working-output composition is unavailable")
  })
  it("keeps exact form edits across durable draft serialization and incomplete recovery", () => {
    const original = result(), draft = createResearchDraft(original)
    draft.items[0].form!.questions[0].label = "Household name"
    const restored = researchDraftCheckpointSchema.parse(JSON.parse(JSON.stringify({ revision: 2, draft, attempted: false }))).draft!
    expect(applyResearchDraft(original, restored).items[0].form?.questions[0].label).toBe("Household name")
    expect(original.items[0].form?.questions[0].label).toBe("Your name")
    const legacy = { version: 1 as const, title: original.title, summary: original.summary, items: [{ key: "signup", title: "Legacy copy edit", description: "" }] }
    expect(applyResearchDraft(original, legacy).items[0].form).toEqual(original.items[0].form)
    draft.items[0].form!.questions = []
    expect(() => validateResearchRecoveryDraft(original, draft)).not.toThrow()
    expect(() => applyResearchDraft(original, draft)).toThrow(/actual questions/)
    const note = result(); note.items[0] = { ...note.items[0], kind: "note", form: null }
    const forged = createResearchDraft(note); forged.items[0].form = definition()
    expect(() => applyResearchDraft(note, forged)).toThrow(/existing form preview/)
  })
  it("binds the current manual form command without inferring response or publication authority", async () => {
    enable()
    const preset = particlePresets.find(preset => preset.id === "form")!
    const form = buildParticlePreset(preset, { id: ID(10), workspaceId: WORKSPACE, now: NOW, title: "Event interest form", description: "", fields: DEFAULT_PRESET_FIELDS, form: definition() })
    expect(bindParticleSource(form)).toEqual({ kind: "workspace_form", organizationId: WORKSPACE, id: ID(10), revision: 0 })
    const capability = particleRegistry.activity.capabilities.workspace_form, action = capability.action
    try { Reflect.set(capability, "action", "disabled"); await expect(prepareResearchApplication(input)).rejects.toThrow(/Form drafts are unavailable/) }
    finally { Reflect.set(capability, "action", action) }
    expect(JSON.stringify(form)).not.toMatch(/versionId|publishedVersion|responseAccess|intakeKey/)
  })
  it("uses the same atomic canonical writer as manual creation, reads back definitions and safely retries", async () => {
    enable(); const draft = createResearchDraft(result()); draft.items[0].form!.questions[0].label = "Household name"
    const prepared = await prepareResearchApplication({ ...input, draft })
    const authorized = await prepareAuthorizedParticleMutation({ input: prepared.batch, workspaceId: WORKSPACE, canEdit: true, now: NOW,
      planningActor: { userId: ID(90), isOrganizationOwner: false }, authorizedResearch: { runId: prepared.runId, objectiveId: prepared.objectiveId } })
    if (!authorized.ok) throw new Error(authorized.error)
    const ai = authorized.value(before), form = ai.graph.particles.find(item => item.id !== ID(1))!
    const manualForm = buildParticlePreset(particlePresets.find(preset => preset.id === "form")!, { id: ID(10), workspaceId: WORKSPACE, now: NOW,
      title: draft.items[0].title, description: draft.items[0].description, fields: DEFAULT_PRESET_FIELDS, form: draft.items[0].form })
    const manual = await applyParticleBatch(before, { id: ID(11), workspaceId: WORKSPACE, baseRevision: 0, operations: [{ kind: "put_particle", expectedRevision: null, particle: manualForm }] }, NOW)
    if (!manual.ok) throw new Error(manual.error)
    expect(form.type === "activity" && form.data.widget).toEqual(manualForm.type === "activity" && manualForm.data.widget)
    expect(formDefinitionSchema.parse(form.type === "activity" && form.data.widget?.kind === "form" ? form.data.widget.definition : null)).toEqual(draft.items[0].form)
    mocks.context.mockResolvedValue({ ...context, graph: ai.graph, objective: ai.graph.particles.find(item => item.id === ID(1)) })
    expect((await prepareResearchApplication({ ...input, draft })).batch).toBeNull()
    vi.stubEnv("WORKSPACE_AI_FORM_OUTPUTS", "")
    expect((await prepareResearchApplication({ ...input, draft })).batch).toBeNull()
    expect((await prepareAuthorizedParticleMutation({ input: prepared.batch, workspaceId: WORKSPACE, canEdit: false, now: NOW })).ok).toBe(false)
    expect(before.particles).toHaveLength(1)
  })
  it("rejects stale plans and invalid mixed output atomically", async () => {
    enable(); mocks.context.mockResolvedValue({ ...context, graph: { ...before, particles: [{ ...before.particles[0], revision: 1 }] } })
    await expect(prepareResearchApplication(input)).rejects.toThrow(/changed/)
    const mixed = result(); mixed.items.push({ ...mixed.items[0], key: "unsupported", kind: "note", form: definition() })
    expect(() => researchPlanOperations(before, mixed, ID(90), NOW, () => ID(99))).toThrow()
    expect(before.particles).toHaveLength(1)
  })
  it("streams only whole validated forms after current access and activation checks", async () => {
    const item = result().items[0], parser = createResearchItemParser(), serialized = JSON.stringify({ items: [item] }), framed = []
    for (let n = 0; n < serialized.length; n += 7) framed.push(...parser(serialized.slice(n, n + 7)).items)
    expect(framed).toEqual([item])
    const published: unknown[] = [], publish = (value: unknown) => { published.push(value) }
    const factory = () => createResearchItemProgress({ publish, revalidate: async () => true, isCanceled: async () => false, evidence: () => [] })
    const event = { item_id: "message", output_index: 0, content_index: 0, sequence_number: 1, delta: serialized } as ResponseTextDeltaEvent
    await factory().push(event); expect(published).toEqual([])
    enable(); await factory().push(event)
    expect(published).toHaveLength(1)
    const projected = projectIncomingResearchPresentation(published as never)
    expect(projected.spec.elements.item_signup).toMatchObject({ type: "WorkspaceForm", props: { definition: definition() } })
    expect(projectResearchPresentation(researchResultSchema.parse(result())).spec.elements.item_signup).toMatchObject({ type: "WorkspaceForm" })
  })
})
