import { beforeEach, describe, expect, it, vi } from "vitest"
import { ID, WORKSPACE, graph, particle } from "./fixtures/particle-fixtures"
const mocks = vi.hoisted(() => ({ actor: vi.fn(), canvases: vi.fn(), board: vi.fn(), editable: vi.fn() }))
vi.mock("@/lib/auth/request-context", () => ({ resolveAuthenticatedAppContext: mocks.actor }))
vi.mock("@/lib/organization/active-org", () => ({ canEditOrganization: mocks.editable }))
vi.mock("@/features/workspace-management", () => ({ allWorkspaceStates: mocks.canvases }))
import { loadResearchContext } from "@/features/workspace-ai/server/research-context"
import { assertResearchContextFits, researchPrompt } from "@/features/workspace-ai/server/research-prompt"
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
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockReturnThis(), maybeSingle: mocks.board }
  mocks.actor.mockResolvedValue({ user: { id: ID(90) }, activeOrg: { orgId: WORKSPACE, role: "owner" }, supabase: { from: () => query } })
  mocks.editable.mockReturnValue(true)
  mocks.board.mockResolvedValue({ data: { state: {} }, error: null })
  mocks.canvases.mockReturnValue([{ id: null, state: { particleGraph: selectedGraph() } }])
})
describe("revision research context", () => {
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
    expect(() => assertResearchContextFits(context, { target, prompt: "Revise", skill: "planning" }, 100)).toThrow(/too large/)
  })
})
