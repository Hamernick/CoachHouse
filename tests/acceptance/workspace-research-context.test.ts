import { beforeEach, describe, expect, it, vi } from "vitest"
import { ID, NOW, WORKSPACE, graph, particle } from "./fixtures/particle-fixtures"
vi.mock("@/lib/organization/particle-ai-origins", () => ({ retainedParticleFiles: async () => new Map(), retainedParticleDocuments: async () => new Map() }))
const mocks = vi.hoisted(() => ({ actor: vi.fn(), canvases: vi.fn(), board: vi.fn(), editable: vi.fn(), hydrate: vi.fn() }))
vi.mock("@/lib/auth/request-context", () => ({ resolveAuthenticatedAppContext: mocks.actor }))
vi.mock("@/lib/organization/active-org", () => ({ canEditOrganization: mocks.editable }))
vi.mock("@/features/workspace-management", () => ({ allWorkspaceStates: mocks.canvases }))
vi.mock("@/features/workspace-ai/server/research-data-view-sources", async original => ({ ...await original<typeof import("@/features/workspace-ai/server/research-data-view-sources")>(), withResearchDataViewSources:mocks.hydrate }))
import { loadResearchContext } from "@/features/workspace-ai/server/research-context"
import { researchContextFingerprint } from "@/features/workspace-ai/server/research-dependencies"
import { researchPrompt } from "@/features/workspace-ai/server/research-prompt"
import { assertInitialResearchRequestFits } from "@/features/workspace-ai/server/research-provider-request"
const config = { tariff: { version: "test", model: "fixture", inputMicrodollarsPerMillion: 1, cachedMicrodollarsPerMillion: 0, outputMicrodollarsPerMillion: 1, webSearchMicrodollarsPerCall: 0, microdollarsPerCredit: 2000 }, maxSearchCalls: 0, maxRounds: 3, maxOutputTokens: 1500, maxInputBytes: 20000, maxCredits: 20, maxCost: 40000 }
const target = { organizationId: WORKSPACE, objectiveId: ID(1), revision: 0, plan: { id: ID(50), revision: 3 } }
function selectedGraph() {
  const objective = particle(1, "objective")
  if (objective.type !== "objective") throw Error()
  const members = Array.from({ length: 12 }, (_, index) => particle(index + 2, index === 0 ? "decision" : "activity"))
  objective.data.planning = { plans: [{ id: ID(50), revision: 3, title: "Current plan", particleIds: members.map(item => item.id), links: [{ source: ID(3), target: ID(4) }] }], proposals: [] }
  return { ...graph([objective, ...members]), revision: 3 }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.hydrate.mockImplementation(async context=>context)
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockReturnThis(), maybeSingle: mocks.board }
  mocks.actor.mockResolvedValue({ user: { id: ID(90) }, activeOrg: { orgId: WORKSPACE, role: "owner" }, supabase: { from: () => query } })
  mocks.editable.mockReturnValue(true)
  mocks.board.mockResolvedValue({ data: { state: {} }, error: null })
  mocks.canvases.mockReturnValue([{ id: null, state: { particleGraph: selectedGraph() } }])
})
describe("revision research context", () => {
  it("skips research-only data views for the picker while retaining access checks",async()=>{
    await loadResearchContext(target,false,{includeDataViewSources:false})
    expect(mocks.hydrate).not.toHaveBeenCalled()
    expect(mocks.board).toHaveBeenCalledOnce()
    await loadResearchContext(target)
    expect(mocks.hydrate).toHaveBeenCalledOnce()
    mocks.editable.mockReturnValue(false)
    await expect(loadResearchContext(target,false,{includeDataViewSources:false})).rejects.toThrow(/editable workspace/)
  })

  it("requires current organization editing access before reading the board", async () => {
    mocks.editable.mockReturnValue(false)
    await expect(loadResearchContext(target)).rejects.toThrow(/editable workspace/)
    expect(mocks.board).not.toHaveBeenCalled()
    mocks.editable.mockReturnValue(true)
    await expect(loadResearchContext({ ...target, organizationId: ID(700) })).rejects.toThrow(/editable workspace/)
    expect(mocks.board).not.toHaveBeenCalled()
  })
  it("requires the exact objective and plan revisions for generation", async () => {
    await expect(loadResearchContext({ ...target, revision: 1 })).rejects.toThrow(/objective changed/)
    await expect(loadResearchContext({ ...target, plan: { ...target.plan, revision: 2 } })).rejects.toThrow(/plan changed/)
    await expect(loadResearchContext({ ...target, plan: { id: ID(51), revision: 3 } })).rejects.toThrow(/plan changed/)
    expect((await loadResearchContext(target)).target).toEqual(target)
  })
  it("allows private recovery after the selected plan changed or was removed", async () => {
    const current = selectedGraph(), objective = current.particles[0]
    if (objective.type !== "objective") throw Error()
    objective.revision = 10; current.revision = 10; objective.data.planning!.plans = []
    mocks.canvases.mockReturnValue([{ id: null, state: { particleGraph: current } }])
    expect((await loadResearchContext(target, false)).objective.revision).toBe(10)
    await expect(loadResearchContext(target)).rejects.toThrow(/objective changed/)
  })
  it("sends every selected member, its status, links and exact decision outcomes", async () => {
    const context = await loadResearchContext(target)
    const prompt = JSON.parse(researchPrompt(context, { target, prompt: "Revise the plan", skill: "planning" }))
    const plan = prompt.objective.selectedPlan
    expect(plan.members).toHaveLength(12)
    expect(plan.members[11].id).toBe(`particle:${ID(13)}`)
    expect(plan.members[0]).toMatchObject({ type: "decision", status: "backlog", revision: 0 })
    const decision = context.graph.particles[1]
    if (decision.type !== "decision") throw Error()
    expect(plan.members[0].outcomes).toEqual(decision.data.outcomes)
    expect(plan.links).toEqual([{ source: `particle:${ID(3)}`, target: `particle:${ID(4)}` }])
    expect(() => assertInitialResearchRequestFits(context, { target, prompt: "Revise", skill: "planning" }, { ...config, maxInputBytes: 100 })).toThrow(/too large/)
  })
})


describe("bounded objective overview", () => {
  async function overview(planCount: number, memberCount: number, pendingCount: number) {
    const context = await loadResearchContext(target)
    const planning = context.objective.data.planning!
    planning.plans = Array.from({ length: planCount }, (_, index) => ({
      id: ID(50 + index), revision: 3, title: `Plan ${index + 1}`,
      particleIds: Array.from({ length: memberCount }, (_, member) => ID(2 + member)),
    }))
    planning.proposals = Array.from({ length: pendingCount }, (_, index) => ({
      id: ID(100 + index), planId: ID(200 + index), baseRevision: null,
      title: `Proposal ${index + 1}`, particleIds: [], authorId: ID(90), createdAt: NOW, status: "pending" as const,
    }))
    planning.proposals.unshift({ id: ID(300), planId: ID(301), baseRevision: null,
      title: "Already rejected", particleIds: [], authorId: ID(90), createdAt: NOW,
      status: "rejected", reviewedBy: ID(90), reviewedAt: NOW })
    const request = { target: { ...target, plan: undefined }, prompt: "Find relevant work", skill: "planning" as const }
    return { context, request, projection: () => JSON.parse(researchPrompt(context, request)).objective }
  }
  it.each([
    { plans: 0, members: 0, pending: 0, shownPlans: 0, shownMembers: 0, shownPending: 0 },
    { plans: 4, members: 8, pending: 4, shownPlans: 4, shownMembers: 8, shownPending: 4 },
    { plans: 5, members: 12, pending: 6, shownPlans: 4, shownMembers: 8, shownPending: 4 },
  ])("reports exact coverage at $plans plans / $members members / $pending pending", async value => {
    const { projection } = await overview(value.plans, value.members, value.pending)
    const result = projection()
    expect(result.planCoverage).toEqual({ shown: value.shownPlans, total: value.plans, omitted: value.plans - value.shownPlans })
    expect(result.plans).toHaveLength(value.shownPlans)
    for (const plan of result.plans) {
      expect(plan.particleIds).toHaveLength(value.shownMembers)
      expect(plan.memberCoverage).toEqual({ shown: value.shownMembers, total: value.members, omitted: value.members - value.shownMembers })
    }
    expect(result.pendingProposals).toHaveLength(value.shownPending)
    expect(result.pendingProposalCoverage).toEqual({ shown: value.shownPending, total: value.pending, omitted: value.pending - value.shownPending })
    expect(result.pendingProposals).not.toContain("Already rejected")
    expect(JSON.stringify(result)).not.toContain('"title":"Plan 5"')
    expect(JSON.stringify(result)).not.toContain('"Proposal 5"')
  })
  it("preserves complete selected context while bounding pending summaries", async () => {
    const { context } = await overview(5, 12, 6)
    const result = JSON.parse(researchPrompt(context, { target, prompt: "Revise", skill: "planning" })).objective
    expect(result.selectedPlan.members).toHaveLength(12)
    expect(result).not.toHaveProperty("plans")
    expect(result).not.toHaveProperty("planCoverage")
    expect(result.pendingProposalCoverage).toEqual({ shown: 4, total: 6, omitted: 2 })
  })
  it("includes changed omission counts in freshness and enforces serialized size", async () => {
    const { context, request } = await overview(5, 12, 6)
    const before = researchContextFingerprint(context, request.target)
    context.objective.data.planning!.plans.push({ id: ID(70), revision: 0, title: "Another omitted plan", particleIds: [] })
    expect(researchContextFingerprint(context, request.target)).not.toBe(before)
    expect(() => assertInitialResearchRequestFits(context, request, config)).not.toThrow()
    expect(() => assertInitialResearchRequestFits(context, request, { ...config, maxInputBytes: 100 })).toThrow(/too large/)
  })
})


describe("unsaved objective admission", () => {
  const target = { mode: "new_objective" as const, organizationId: WORKSPACE, canvasId: null, revision: 0 }
  it("loads an empty canvas without fabricating an objective", async () => {
    mocks.canvases.mockReturnValue([{ id: null, state: {} }])
    const context = await loadResearchContext(target)
    expect(context.objective).toBeUndefined()
    expect(context.graph.particles).toEqual([])
    const prompt = JSON.parse(researchPrompt(context, { target, prompt: "Open a community garden", skill: "planning" }))
    expect(prompt.objective.mode).toBe("new_objective")
    expect(prompt.objective.objectiveCoverage).toEqual({ shown: 0, total: 0, omitted: 0 })
    expect(prompt.task).toBe("Open a community garden")
  })
  it("rejects missing, deleted, ambiguous or stale canvases", async () => {
    await expect(loadResearchContext(target)).rejects.toThrow(/Workspace changed/)
    mocks.canvases.mockReturnValue([])
    await expect(loadResearchContext(target)).rejects.toThrow(/Workspace unavailable/)
    mocks.canvases.mockReturnValue([{ id: null, state: {} }, { id: null, state: {} }])
    await expect(loadResearchContext(target)).rejects.toThrow(/Workspace unavailable/)
    mocks.canvases.mockReturnValue([{ id: null, state: {} }])
    await expect(loadResearchContext({ ...target, canvasId: ID(600) })).rejects.toThrow(/Workspace unavailable/)
  })
  it("keeps named-canvas context isolated and rejects fake objective identities", async () => {
    mocks.canvases.mockReturnValue([{ id: null, state: { particleGraph: selectedGraph() } }, { id: ID(600), state: {} }])
    const context = await loadResearchContext({ ...target, canvasId: ID(600) })
    expect(context.canvasId).toBe(ID(600)); expect(context.graph.particles).toEqual([])
    await expect(loadResearchContext({ ...target, objectiveId: ID(1) } as never)).rejects.toThrow()
    await expect(loadResearchContext({ ...target, plan: { id: ID(2), revision: 0 } } as never)).rejects.toThrow()
  })
  it("rechecks organization permissions even on an empty canvas", async () => {
    mocks.canvases.mockReturnValue([{ id: null, state: {} }])
    mocks.editable.mockReturnValue(false)
    await expect(loadResearchContext(target)).rejects.toThrow(/editable workspace/)
    expect(mocks.board).not.toHaveBeenCalled()
  })
})
