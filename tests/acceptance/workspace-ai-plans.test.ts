import { beforeEach, describe, expect, it, vi } from "vitest"
import { bindAiPlan, generatedPlanSchema, aiPlanProposal } from "@/features/workspace-objectives/lib/ai-plan-proposal"
import { handleWorkspaceAiPlan } from "@/features/workspace-objectives/server/ai-plan-generation"
const mocks = vi.hoisted(() => ({ objective: vi.fn(), read: vi.fn(), reserve: vi.fn(), claim: vi.fn(), settle: vi.fn(), correlate: vi.fn(), reconcile: vi.fn(), provider: vi.fn(), document: vi.fn() }))
vi.mock("@/features/workspace-objectives/server/ai-plan-context", () => ({ loadPlanObjective: mocks.objective, loadAiPlan: mocks.read }))
vi.mock("@/features/ai-credits", () => ({ reserveAiRun: mocks.reserve, claimAiRun: mocks.claim, settleAiRun: mocks.settle, correlateAiResponse: mocks.correlate, reconcileAiRun: mocks.reconcile }))
vi.mock("@/features/workspace-ai/server", async () => ({ ...await vi.importActual("@/features/workspace-ai/server/request-body"), streamWorkspaceDraft: mocks.provider, loadAiDocument: mocks.document, workspaceAiConfig: () => ({ tariff: { version: "fixture", model: "fixture" }, maxInputBytes: 70000, maxOutputTokens: 6000, maxCredits: 100, maxCost: 200000 }) }))
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const target = { organizationId: id(1), userId: id(2), objectiveId: id(3), revision: "2026-10-22T12:00:00Z" }
const generated = { title: "Event plan", summary: "Choose a venue, then prepare the event.", assumptions: ["Venue access is not confirmed."], questions: ["Is a venue available?"],
  steps: [{ key: "venue", title: "Venue available?", kind: "decision" }, { key: "local", title: "Prepare the venue", kind: "action" }, { key: "online", title: "Prepare online session", kind: "action" }],
  edges: [{ source: "venue", target: "local", label: "Yes" }, { source: "venue", target: "online", label: "No" }] }
const request = (patch = {}) => new Request("http://localhost:3008/api/workspace/ai/plan", { method: "POST", headers: { origin: "http://localhost:3008" }, body: JSON.stringify({ id: id(4), target, prompt: "Plan a community event", maximumCredits: 100, tariffVersion: "fixture", ...patch }) })
let saved: unknown
beforeEach(() => {
  vi.clearAllMocks()
  saved = null
  mocks.document.mockResolvedValue({ section: { id: "mission", title: "Mission", lastUpdated: target.revision, content: "Serve local families." } })
  mocks.objective.mockResolvedValue({ orgId: id(1), userId: id(2), objective: { title: "Community event", description: null } })
  mocks.reserve.mockResolvedValue({ created: true }); mocks.claim.mockResolvedValue(true); mocks.reconcile.mockResolvedValue(undefined)
  mocks.provider.mockImplementation(async ({ onResponse }) => { await onResponse("response-1"); return { text: JSON.stringify(generated), usage: { input: 500, cachedInput: 0, output: 800 }, completed: true } })
  mocks.settle.mockImplementation(async input => { saved = { id: input.id, actor_id: id(2), org_id: id(1), task: "plan", target: mocks.reserve.mock.calls.at(-1)?.[0].target ?? { ...target, kind: "plan", title: "Community event", description: null }, status: input.status, proposal: input.proposal, charged_credits: input.status === "succeeded" ? 5 : 0, max_credits: 100 }; return saved })
  mocks.read.mockImplementation(async () => ({ proposal: aiPlanProposal(saved) }))
})
describe("reviewed metered plan generation", () => {
  it("reserves before provider work, binds canonical IDs, and settles before delivering a private proposal", async () => {
    const response = await handleWorkspaceAiPlan(request()); expect(response.status).toBe(200)
    const { proposal } = await response.json()
    expect(mocks.reserve.mock.invocationCallOrder[0]).toBeLessThan(mocks.provider.mock.invocationCallOrder[0])
    expect(mocks.correlate).toHaveBeenCalledWith(id(4), "response-1")
    expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({ task: "plan", organizationId: id(1), actorId: id(2) }))
    const format = mocks.provider.mock.calls[0][0].textFormat
    expect(format).toMatchObject({ type: "json_schema", name: "workspace_plan", strict: true, schema: { additionalProperties: false } })
    expect(format.schema.required).toEqual(expect.arrayContaining(["title", "summary", "assumptions", "questions", "steps", "edges"]))
    expect(proposal.content.draft.id).toBe(id(4))
    expect(proposal.content.draft.steps.every((step: { id: string; status: string }) => step.id.length === 36 && step.status === "todo")).toBe(true)
    expect(proposal.content.draft.decisions[0].selectedEdgeId).toBeNull()
    expect(proposal.application).toBeNull()
    expect(proposal.credits).toBe(5)
  })
  it("rejects origin, oversized input, access, stale tariff and budget failures before spending", async () => {
    expect((await handleWorkspaceAiPlan(new Request("http://localhost:3008/api/workspace/ai/plan", { method: "POST", headers: { origin: "https://elsewhere.test" }, body: "{}" }))).status).toBe(403)
    expect((await handleWorkspaceAiPlan(request({ prompt: "x".repeat(13000) }))).status).toBe(400)
    expect((await handleWorkspaceAiPlan(request({ tariffVersion: "old" }))).status).toBe(400)
    mocks.objective.mockRejectedValueOnce(new Error("Access denied"))
    expect((await handleWorkspaceAiPlan(request())).status).toBe(400)
    expect(mocks.reserve).not.toHaveBeenCalled()
    mocks.reserve.mockRejectedValueOnce(new Error("Not enough credits"))
    expect((await handleWorkspaceAiPlan(request())).status).toBe(400)
    expect(mocks.provider).not.toHaveBeenCalled()
  })
  it("includes only explicitly selected server-loaded context and records its canonical revision", async () => {
    await handleWorkspaceAiPlan(request())
    expect(JSON.parse(mocks.provider.mock.calls[0][0].context).selectedDocument).toBeNull()
    expect(mocks.document).not.toHaveBeenCalled()
    await handleWorkspaceAiPlan(request({ document: { sectionId: "mission", title: "Untrusted client title", revision: target.revision } }))
    expect(mocks.document).toHaveBeenCalledWith({ sectionId: "mission", title: "Untrusted client title", revision: target.revision, userId: target.userId, organizationId: target.organizationId })
    expect(JSON.parse(mocks.provider.mock.calls[1][0].context).selectedDocument).toEqual({ sectionId: "mission", title: "Mission", revision: target.revision, content: "Serve local families." })
    expect(mocks.reserve.mock.calls[1][0].target.document).toEqual({ sectionId: "mission", title: "Mission", revision: target.revision })
    expect(JSON.stringify(mocks.reserve.mock.calls[1][0].target)).not.toContain("Serve local families")
    expect(mocks.reserve.mock.calls[1][0].hash).not.toBe(mocks.reserve.mock.calls[0][0].hash)
  })
  it("rejects unavailable, stale, forged-scope and oversized document context before charging", async () => {
    const document = { sectionId: "mission", title: "Mission", revision: target.revision }
    for (const message of ["Access denied", "This document changed"]) {
      mocks.document.mockRejectedValueOnce(new Error(message))
      expect((await handleWorkspaceAiPlan(request({ document }))).status).toBe(400)
    }
    expect((await handleWorkspaceAiPlan(request({ document: { ...document, organizationId: id(9) } }))).status).toBe(400)
    mocks.document.mockResolvedValueOnce({ section: { id: "mission", title: "Mission", lastUpdated: target.revision, content: "x".repeat(70000) } })
    expect((await handleWorkspaceAiPlan(request({ document }))).status).toBe(400)
    expect(mocks.reserve).not.toHaveBeenCalled(); expect(mocks.provider).not.toHaveBeenCalled()
  })
  it("cannot silently remove source context when revising an earlier proposal", async () => {
    mocks.read.mockResolvedValueOnce({ proposal: { id: id(5), target, status: "succeeded", application: null, document: { sectionId: "mission", title: "Mission", revision: target.revision } } })
    expect((await handleWorkspaceAiPlan(request({ reviseRunId: id(5) }))).status).toBe(400)
    expect(mocks.reserve).not.toHaveBeenCalled(); expect(mocks.provider).not.toHaveBeenCalled()
  })
  it("settles malformed/unsafe graphs without a customer charge, retaining measured provider cost", async () => {
    mocks.provider.mockResolvedValue({ text: JSON.stringify({ ...generated, edges: [...generated.edges, { source: "local", target: "venue", label: "Loop" }] }), usage: { input: 10, cachedInput: 0, output: 20 }, completed: true })
    const { proposal } = await (await handleWorkspaceAiPlan(request())).json()
    expect(proposal.status).toBe("failed"); expect(proposal.credits).toBe(0); expect(proposal.content).toBeNull()
    expect(mocks.settle).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", proposal: null, usage: { input: 10, cachedInput: 0, output: 20 } }))
  })
  it("holds unknown usage for existing recovery rather than retrying provider work", async () => {
    mocks.provider.mockRejectedValue(new Error("Stream lost"))
    const result = await (await handleWorkspaceAiPlan(request())).json()
    expect(result.reserved).toBe(true); expect(mocks.settle).not.toHaveBeenCalled()
    expect(mocks.reconcile).toHaveBeenCalledWith(id(4), null)
    expect(mocks.provider).toHaveBeenCalledOnce()
  })
  it("recovers an existing run without another provider request", async () => {
    mocks.reserve.mockResolvedValue({ created: false }); mocks.read.mockResolvedValue({ proposal: { id: id(4), status: "running" } })
    expect((await (await handleWorkspaceAiPlan(request())).json()).proposal.status).toBe("running")
    expect(mocks.provider).not.toHaveBeenCalled()
  })
  it("revises private proposals, rejecting applied or stale sources before spending", async () => {
    const previous = { id: id(5), target, status: "succeeded", application: null, content: bindAiPlan(JSON.stringify(generated), id(5), target.objectiveId, () => crypto.randomUUID()) }
    mocks.read.mockResolvedValueOnce({ proposal: previous })
    await handleWorkspaceAiPlan(request({ reviseRunId: id(5) }))
    expect(JSON.parse(mocks.provider.mock.calls[0][0].context).previousProposal).toEqual(previous.content)
    mocks.reserve.mockClear(); mocks.provider.mockClear()
    for (const proposal of [{ ...previous, application: {} }, { ...previous, target: { ...target, revision: "changed" } }]) {
      mocks.read.mockResolvedValueOnce({ proposal })
      expect((await handleWorkspaceAiPlan(request({ reviseRunId: id(5) }))).status).toBe(400)
    }
    expect(mocks.reserve).not.toHaveBeenCalled(); expect(mocks.provider).not.toHaveBeenCalled()
  })
})
describe("bounded typed plan proposals", () => {
  it("rejects dangling references, duplicates, executable fields, and unnamed decisions", () => {
    for (const value of [{ ...generated, steps: [...generated.steps, generated.steps[0]] }, { ...generated, edges: [{ source: "venue", target: "foreign", label: "" }] }, { ...generated, execute: "fetch(...)" }, { ...generated, edges: generated.edges.map(edge => ({ ...edge, label: "" })) }]) expect(generatedPlanSchema.safeParse(value).success).toBe(false)
  })
  it("allows questions before a plan exists, and rejects empty no-op replies", () => {
    expect(generatedPlanSchema.safeParse({ ...generated, steps: [], edges: [] }).success).toBe(true)
    expect(generatedPlanSchema.safeParse({ ...generated, steps: [], edges: [], questions: [] }).success).toBe(false)
  })
})


describe("saved plan revisions", () => {
  const baseline = () => {
    const draft = bindAiPlan(JSON.stringify(generated), id(50), target.objectiveId, () => crypto.randomUUID()).draft
    draft.revision = 2; draft.steps[1].status = "done"
    draft.steps.forEach(step => { step.expectedUpdatedAt = target.revision })
    draft.decisions![0].selectedEdgeId = draft.edges[0].id
    return draft
  }
  it("binds existing steps, completed work, unchanged edges and explicit choices without trusting provider IDs", () => {
    const before = baseline()
    const keys = new Map(generated.steps.map((step, index) => [step.key, `saved_${index}`]))
    const output = { ...generated, steps: generated.steps.map(step => ({ ...step, key: keys.get(step.key), title: `${step.title} revised` })), edges: generated.edges.map(edge => ({ ...edge, source: keys.get(edge.source), target: keys.get(edge.target) })) }
    const revised = bindAiPlan(JSON.stringify(output), id(51), target.objectiveId, () => crypto.randomUUID(), before).draft
    expect(revised.id).toBe(before.id); expect(revised.revision).toBe(2)
    expect(revised.steps.map(step => step.id)).toEqual(before.steps.map(step => step.id))
    expect(revised.steps[1].status).toBe("done")
    expect(revised.edges).toEqual(before.edges); expect(revised.decisions).toEqual(before.decisions)
    expect(() => bindAiPlan(JSON.stringify({ ...output, steps: [{ key: "saved_999", title: "Unknown", kind: "action" }], edges: [] }), id(51), target.objectiveId, () => crypto.randomUUID(), before)).toThrow("Unknown saved step")
  })
  it("loads saved plan context before charging and retains its exact baseline for atomic review", async () => {
    const before = baseline()
    mocks.objective.mockResolvedValue({ orgId: id(1), userId: id(2), objective: { title: "Community event", description: null }, baseline: before })
    const result = await (await handleWorkspaceAiPlan(request({ target: { ...target, plan: { id: before.id, revision: before.revision } } }))).json()
    expect(result.proposal.content.draft.id).toBe(before.id)
    expect(result.proposal.baseline).toEqual(before)
    expect(mocks.reserve.mock.calls[0][0].target.planBaseline).toEqual(before)
    expect(JSON.parse(mocks.provider.mock.calls[0][0].context).savedPlan.steps[1]).toMatchObject({ key: "saved_1", status: "done" })
  })
  it("rejects a stale saved baseline before revising a private proposal", async () => {
    const before = baseline()
    mocks.objective.mockResolvedValue({ orgId: id(1), userId: id(2), objective: { title: "Community event" }, baseline: before })
    mocks.read.mockResolvedValueOnce({ proposal: { id: id(5), target, status: "succeeded", application: null, baseline: { ...before, title: "Older title" } } })
    expect((await handleWorkspaceAiPlan(request({ reviseRunId: id(5) }))).status).toBe(400)
    expect(mocks.reserve).not.toHaveBeenCalled()
  })
})
