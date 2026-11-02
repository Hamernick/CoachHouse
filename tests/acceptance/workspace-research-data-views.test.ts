import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ID, WORKSPACE, NOW, graph, particle } from "./fixtures/particle-fixtures"
import { bindResearch } from "@/features/workspace-ai/lib/research-contract"
import { createResearchDraft, applyResearchDraft } from "@/features/workspace-ai/lib/research-draft"
import { createResearchOutputBindings, researchOutputBindingsSchema } from "@/features/workspace-ai/lib/research-data-view"
import { prepareReviewedResearchSources } from "@/features/workspace-ai/lib/research-source-application"
import { projectResearchPresentation } from "@/features/workspace-ai/lib/research-presentation"
import { ResearchPlanPresentation } from "@/features/workspace-ai/components/research-presentation"
import { providerResearchSchema, providerFormResearchSchema, providerDataViewResearchSchema, providerWorkingResearchSchema, type ResearchResult } from "@/features/workspace-ai/research-types"
import { researchPlanOperations } from "@/features/workspace-particles/lib/research-plan"
import { researchProviderOutputSchema, assertResearchOutputAvailability } from "@/features/workspace-ai/server/research-output-config"
import { researchProviderRequest, researchRequestFits } from "@/features/workspace-ai/server/research-provider-request"
const saved = vi.hoisted(() => ({ context: vi.fn(), run: vi.fn(), rpc: vi.fn(), load: vi.fn() }))
vi.mock("@/features/workspace-ai/server/research-context", () => ({ loadResearchContext: saved.context }))
vi.mock("@/features/ai-credits", () => ({ readAiRun: saved.run }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: saved.rpc }) }))
vi.mock("@/features/workspace-ai/server/knowledge-records", () => ({ knowledgeLoader: () => saved.load }))
import { prepareResearchApplication } from "@/features/workspace-ai/server/research-application"
import { readWorkspaceResearchSourceEffects, applyWorkspaceResearchSourceEffects } from "@/features/workspace-ai/research-source-actions"
import { researchContextFingerprint } from "@/features/workspace-ai/server/research-dependencies"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { particleRegistry } from "@/features/workspace-particles/lib/particle-registry"
const source = vi.hoisted(() => ({ read: vi.fn(), create: vi.fn() }))
vi.mock("@/features/workspace-data-views/server", () => ({ readProjectDataViewCreation: source.read, runDataViewCommand: source.create }))
import { applyResearchDataViewEffects, inspectResearchDataViewEffects, researchDataViewCommands } from "@/features/workspace-ai/server/research-data-view-effects"
const absent = { ok: true, data: { receipt: null, view: null } }
function result(count = 1): ResearchResult {
  const items = Array.from({ length: count }, (_, i) => ({ key: `view_${i}`, title: `Projects ${i}`, description: "Existing projects; no copied rows.", kind: "data_view" as const, dataView: { kind: "projects" as const }, referenceId: null, evidenceIds: [], dependsOn: [] }))
  let n = 200
  return { title: "Project review", summary: "Save a view", questions: [], unfulfilled: [], decisions: [], removeReferences: [], sources: [], runId: ID(8),
    target: { organizationId: WORKSPACE, objectiveId: ID(1), revision: 0 }, items, outputBindings: createResearchOutputBindings(items, () => ID(n++)) }
}
function generated(value = result()) { const { target: _target, runId: _run, sources: _sources, outputBindings: _bindings, ...output } = value; return output }
const existing = (viewId: string, name = "Projects 0") => ({ ok: true, data: { receipt: { viewId, revision: 1 }, view: { id: viewId, name, revision: 1 } } })
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("WORKSPACE_AI_FORM_OUTPUTS", ""); vi.stubEnv("WORKSPACE_AI_DATA_VIEW_OUTPUTS", ""); vi.stubEnv("NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION", "")
  source.read.mockResolvedValue(absent)
  source.create.mockImplementation(async command => ({ ok: true, data: { viewId: command.viewId, revision: 1 } }))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe("qualified project-view working output", () => {
  it("keeps both composition gates off by default and selects exactly the enabled provider capabilities", () => {
    expect(researchProviderOutputSchema()).toBe(providerResearchSchema)
    expect(providerResearchSchema.safeParse(generated()).success).toBe(false)
    expect(() => assertResearchOutputAvailability(result().items)).toThrow(/not enabled/)
    vi.stubEnv("WORKSPACE_AI_DATA_VIEW_OUTPUTS", "1")
    expect(researchProviderOutputSchema()).toBe(providerResearchSchema)
    vi.stubEnv("NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION", "1")
    expect(researchProviderOutputSchema()).toBe(providerDataViewResearchSchema)
    expect(providerDataViewResearchSchema.parse(generated()).items[0].dataView).toEqual({ kind: "projects" })
    vi.stubEnv("WORKSPACE_AI_FORM_OUTPUTS", "1")
    expect(researchProviderOutputSchema()).toBe(providerWorkingResearchSchema)
    vi.stubEnv("WORKSPACE_AI_DATA_VIEW_OUTPUTS", "")
    expect(researchProviderOutputSchema()).toBe(providerFormResearchSchema)
  })
  it.each([{ kind: "responses" }, { kind: "table", tableId: ID(5) }, { kind: "projects", rows: [] }, { kind: "projects", filter: "active" }, { kind: "projects", audienceConfirmed: true }])("rejects unsupported or authority-forging sources %j", dataView => {
    const value = generated(); Reflect.set(value.items[0], "dataView", dataView)
    expect(() => bindResearch(JSON.stringify(value), [], result().target, ID(8))).toThrow()
  })
  it("rejects provider identities, missing sources and forged non-view sources", () => {
    expect(providerDataViewResearchSchema.safeParse({ ...generated(), outputBindings: result().outputBindings }).success).toBe(false)
    const missing = generated(); Reflect.deleteProperty(missing.items[0], "dataView")
    expect(() => bindResearch(JSON.stringify(missing), [], result().target, ID(8))).toThrow()
    const note = generated(); Reflect.set(note.items[0], "kind", "note")
    expect(() => bindResearch(JSON.stringify(note), [], result().target, ID(8))).toThrow()
    expect(() => createResearchOutputBindings(result(2).items, () => ID(1))).toThrow(/distinct/)
    expect(researchOutputBindingsSchema.parse(result(2).outputBindings)).toHaveLength(2)
  })
  it("retains stable identities and source metadata through human copy edits, rejecting unsupported settings", () => {
    const original = result(), draft = createResearchDraft(original); draft.items[0].title = "Reviewed title"
    const edited = applyResearchDraft(original, draft)
    expect(edited.outputBindings).toEqual(original.outputBindings)
    expect(edited.items[0].dataView).toEqual({ kind: "projects" })
    expect(researchDataViewCommands(edited)[0].command).toEqual({ action: "create_view", organizationId: WORKSPACE, viewId: ID(200), requestId: ID(201), name: "Reviewed title", source: { kind: "projects" } })
    draft.items[0].title = "x".repeat(101)
    expect(() => applyResearchDraft(original, draft)).toThrow(/100/)
    Reflect.set(draft.items[0], "dataView", { kind: "projects" })
    expect(() => applyResearchDraft(original, draft)).toThrow()
  })
  it("binds only server-assigned source IDs into reference-only canonical widgets", () => {
    let n = 300
    const operations = researchPlanOperations(graph([particle(1, "objective")]), result(), ID(90), NOW, () => ID(n++))
    const views = operations.flatMap(op => op.kind === "put_particle" && op.particle.type === "activity" ? [op.particle.data.widget] : [])
    expect(views).toEqual([{ kind: "data_view", viewId: ID(200) }])
    const invalid = result(); delete invalid.outputBindings
    expect(() => researchPlanOperations(graph([particle(1, "objective")]), invalid, ID(90), NOW, () => ID(n++))).toThrow(/identity/)
  })
  it("renders declared columns without querying source rows or inventing counts", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch)
    const presentation = projectResearchPresentation(result())
    expect(presentation.spec.elements.item_view_0.type).toBe("ProjectDataView")
    const html = renderToStaticMarkup(createElement(ResearchPlanPresentation, { result: result() }))
    for (const label of ["Project", "Status", "Starts", "Ends"]) expect(html).toContain(label)
    expect(html).toContain("Records and counts")
    expect(fetch).not.toHaveBeenCalled(); expect(source.read).not.toHaveBeenCalled(); expect(source.create).not.toHaveBeenCalled()
  })
  it("fits the approved bounded request with both working-output schemas without provider calls", () => {
    vi.stubEnv("NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION", "1"); vi.stubEnv("WORKSPACE_AI_FORM_OUTPUTS", "1"); vi.stubEnv("WORKSPACE_AI_DATA_VIEW_OUTPUTS", "1")
    const config = { tariff: { version: "fixture", model: "fixture", inputMicrodollarsPerMillion: 1, cachedMicrodollarsPerMillion: 0, outputMicrodollarsPerMillion: 1, webSearchMicrodollarsPerCall: 0, microdollarsPerCredit: 2000 }, maxRounds: 3, maxSearchCalls: 0, maxInputBytes: 20000, maxOutputTokens: 1500, maxCredits: 20, maxCost: 40000 }
    const request = researchProviderRequest(config, [{ role: "user", content: "Prepare a projects view" }])
    expect(researchRequestFits(request, 20000)).toBe(true); expect(request.store).toBe(false)
    expect(request.instructions).toContain("projects")
  })
})

describe("explicit source effects and honest recovery", () => {
  it("pins the exact reviewed draft before creating and stops when preservation fails or the session changes", async () => {
    const order: string[] = [], original = result(), draft = createResearchDraft(original); draft.items[0].title = "Human name"
    const saveDraft = vi.fn(async (saved, attempted) => { expect(saved).toEqual(draft); expect(attempted).toBe(true); order.push("pin"); return true })
    const applySources = vi.fn(async () => { order.push("source"); return true })
    expect(await prepareReviewedResearchSources({ result: original, draft, saveDraft, applySources, isCurrent: () => true })).toEqual({ ready: true, draft })
    expect(order).toEqual(["pin", "source"])
    applySources.mockClear()
    expect((await prepareReviewedResearchSources({ result: original, draft, saveDraft, applySources, isCurrent: () => false })).ready).toBe(false)
    saveDraft.mockResolvedValue(false)
    expect((await prepareReviewedResearchSources({ result: original, draft, saveDraft, applySources, isCurrent: () => true })).ready).toBe(false)
    expect(applySources).not.toHaveBeenCalled()
  })
  it("pins even an unedited source proposal and blocks plan application on partial source failure", async () => {
    const saveDraft = vi.fn().mockResolvedValue(true), applySources = vi.fn().mockResolvedValue(false)
    const prepared = await prepareReviewedResearchSources({ result: result(), saveDraft, applySources, isCurrent: () => true })
    expect(saveDraft).toHaveBeenCalledWith(createResearchDraft(result()), true)
    expect(prepared.ready).toBe(false)
  })
  it("read-only recovery never invokes the source writer, including absent receipts", async () => {
    expect((await inspectResearchDataViewEffects(result()))[0].status).toBe("not_created")
    expect(source.create).not.toHaveBeenCalled()
    source.read.mockResolvedValue(existing(ID(200)))
    expect((await inspectResearchDataViewEffects(result()))[0].status).toBe("created")
    expect(source.create).not.toHaveBeenCalled()
  })
  it("retains successful first effects and retries only independently confirmed absent requests", async () => {
    source.create.mockResolvedValueOnce({ ok: true, data: { viewId: ID(200), revision: 1 } }).mockResolvedValueOnce({ ok: false, code: "unavailable", error: "No confirmation" })
    expect((await applyResearchDataViewEffects(result(2))).map(item => item.status)).toEqual(["created", "uncertain"])
    source.read.mockImplementation(async command => command.viewId === ID(200) ? existing(ID(200)) : absent)
    source.create.mockClear()
    expect((await applyResearchDataViewEffects(result(2))).map(item => item.status)).toEqual(["created", "created"])
    expect(source.create).toHaveBeenCalledTimes(1)
    expect(source.create.mock.calls[0][0].viewId).toBe(ID(202))
  })
  it("recovers a committed effect after a lost response without replaying creation", async () => {
    source.create.mockResolvedValueOnce({ ok: false, code: "unavailable", error: "Response lost" })
    expect((await applyResearchDataViewEffects(result()))[0].status).toBe("uncertain")
    source.read.mockResolvedValue(existing(ID(200)))
    source.create.mockClear()
    expect((await applyResearchDataViewEffects(result()))[0].status).toBe("created")
    expect(source.create).not.toHaveBeenCalled()
  })
  it.each(["denied", "conflict", "unavailable"])("does not turn %s recovery into a new effect", async code => {
    source.read.mockResolvedValue({ ok: false, code, error: "Unavailable" })
    expect((await applyResearchDataViewEffects(result()))[0].status).toBe(code === "unavailable" ? "uncertain" : code)
    expect(source.create).not.toHaveBeenCalled()
  })
  it("preserves evidence of a deleted view without recreating it or claiming a rolled-back effect", async () => {
    source.read.mockResolvedValue({ ok: true, data: { receipt: { viewId: ID(200), revision: 1 }, view: null } })
    const effect = (await applyResearchDataViewEffects(result()))[0]
    expect(effect.status).toBe("denied"); expect(effect.message).toContain("Creation is confirmed")
    expect(source.create).not.toHaveBeenCalled()
  })
  it("rejects all invalid identities before the first effect and distrusts mismatched creation receipts", async () => {
    const invalid = result(2); invalid.outputBindings!.pop()
    await expect(applyResearchDataViewEffects(invalid)).rejects.toThrow(/identity/)
    expect(source.create).not.toHaveBeenCalled(); expect(source.read).not.toHaveBeenCalled()
    source.create.mockResolvedValue({ ok: true, data: { viewId: ID(999), revision: 1 } })
    expect((await applyResearchDataViewEffects(result()))[0].status).toBe("uncertain")
  })
})

function setupSaved() {
  vi.stubEnv("WORKSPACE_AI_DATA_VIEW_OUTPUTS", "1"); vi.stubEnv("NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION", "1")
  const value = result(), before = graph([particle(1, "objective")])
  const context = { user: { id: ID(90) }, graph: before, objective: before.particles[0], canvasId: null, target: value.target } as ResearchContext
  value.dependencies = { version: 1, contextFingerprint: researchContextFingerprint(context), records: [] }
  const run = { id: value.runId, status: "succeeded", target: { ...value.target, kind: "particle_research", userId: ID(90), canvasId: null }, proposal: JSON.stringify(value), charged_credits: 2, cancel_requested_at: null }
  saved.context.mockResolvedValue(context); saved.run.mockResolvedValue(run); saved.load.mockResolvedValue([])
  saved.rpc.mockResolvedValue({ data: { revision: 1, draft: createResearchDraft(value), attempted: true }, error: null })
  return { value, context, run, input: { runId: value.runId, organizationId: WORKSPACE, objectiveId: ID(1) } }
}

describe("server source and plan application boundaries", () => {
  it("requires a durable exact attempted draft before the first source mutation", async () => {
    const { value } = setupSaved()
    saved.rpc.mockResolvedValue({ data: { revision: 1, draft: createResearchDraft(value), attempted: false }, error: null })
    expect(await applyWorkspaceResearchSourceEffects({ runId: value.runId, target: value.target })).toHaveProperty("error")
    expect(source.read).not.toHaveBeenCalled(); expect(source.create).not.toHaveBeenCalled()
  })
  it("separates successful source effects from the canonical plan transaction", async () => {
    const { value, input } = setupSaved()
    const effects = await applyWorkspaceResearchSourceEffects({ runId: value.runId, target: value.target })
    expect(effects).toMatchObject({ effects: [{ status: "created" }], planApplied: false })
    expect(source.create).toHaveBeenCalledTimes(1)
    await expect(prepareResearchApplication(input)).rejects.toThrow(/not confirmed/)
    source.read.mockResolvedValue(existing(ID(200)))
    expect((await prepareResearchApplication(input)).batch).not.toBeNull()
    expect(source.create).toHaveBeenCalledTimes(1)
  })
  it("rejects different human edits and a changed manual command before new source writes", async () => {
    const { value, input } = setupSaved(), draft = createResearchDraft(value); draft.items[0].title = "Changed after attempt"
    await expect(prepareResearchApplication({ ...input, draft }, { prepareSources: true })).rejects.toThrow(/exact source-effect draft/)
    const capability = particleRegistry.activity.outputCapabilities.project_data_view, previous = capability.action
    try {
      Reflect.set(capability, "action", "disabled")
      expect(await applyWorkspaceResearchSourceEffects({ runId: value.runId, target: value.target })).toHaveProperty("error")
    } finally { Reflect.set(capability, "action", previous) }
    expect(source.create).not.toHaveBeenCalled()
  })
  it("keeps recovery read-only after newer plan revision while refusing stale new effects", async () => {
    const { value, context } = setupSaved()
    const objective = { ...context.objective!, revision: 1 }
    const changed = { ...context, objective, graph: { ...context.graph, revision: 1, particles: [objective] } }
    saved.context.mockResolvedValue(changed)
    source.read.mockResolvedValue(existing(ID(200)))
    expect(await readWorkspaceResearchSourceEffects({ runId: value.runId, target: { ...value.target, revision: 1 } })).toMatchObject({ effects: [{ status: "created" }], planApplied: false })
    expect(await applyWorkspaceResearchSourceEffects({ runId: value.runId, target: { ...value.target, revision: 1 } })).toHaveProperty("error")
    expect(source.create).not.toHaveBeenCalled()
  })
  it("does not grant foreign actor or target access through receipt recovery", async () => {
    const { value, run } = setupSaved()
    saved.run.mockResolvedValue({ ...run, target: { ...run.target, userId: ID(99) } })
    expect(await readWorkspaceResearchSourceEffects({ runId: value.runId, target: value.target })).toHaveProperty("error")
    saved.run.mockResolvedValue(run)
    expect(await readWorkspaceResearchSourceEffects({ runId: value.runId, target: { ...value.target, organizationId: ID(99) } })).toHaveProperty("error")
    expect(source.read).not.toHaveBeenCalled(); expect(source.create).not.toHaveBeenCalled()
  })
  it("allows read-only receipts when composition is disabled and no-ops previously applied plans", async () => {
    const { value, input, context } = setupSaved()
    source.read.mockResolvedValue(existing(ID(200)))
    const prepared = await prepareResearchApplication(input)
    const applied = await applyParticleBatch(context.graph, prepared.batch!, NOW)
    if (!applied.ok) throw Error(applied.error)
    saved.context.mockResolvedValue({ ...context, graph: applied.value.graph, objective: applied.value.graph.particles.find(item => item.id === ID(1)) })
    vi.stubEnv("WORKSPACE_AI_DATA_VIEW_OUTPUTS", "")
    expect((await prepareResearchApplication(input)).batch).toBeNull()
    expect(await applyWorkspaceResearchSourceEffects({ runId: value.runId, target: value.target })).toMatchObject({ effects: [{ status: "created" }], planApplied: true })
    expect(source.create).not.toHaveBeenCalled()
  })
})
