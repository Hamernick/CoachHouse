import { describe, expect, it } from "vitest"
import { readParticleWalkthrough } from "@/features/workspace-particles/lib/particle-walkthrough"
import { ID, WORKSPACE, graph, particle } from "./fixtures/particle-fixtures"

function fixture(count = 3) {
  const objective = particle(1, "objective")
  if (objective.type !== "objective") throw new Error("Expected objective")
  const items = Array.from({ length: count }, (_, index) => particle(index + 2))
  const plan = { id: ID(500), revision: 0, title: "Plan", particleIds: items.map(item => item.id), links: [] as { source: string; target: string; outcome?: string }[] }
  objective.data.planning = { plans: [plan], proposals: [] }
  return { state: graph([objective, ...items]), objective, plan, reference: { workspaceId: WORKSPACE, objectiveId: objective.id, planId: plan.id } }
}

describe("Particle walkthrough projection", () => {
  it("respects directed links, uses membership order for ties, and never mutates", () => {
    const { state, plan, reference } = fixture()
    plan.links = [{ source: ID(4), target: ID(2) }]
    const before = JSON.stringify(state)
    expect(readParticleWalkthrough(state, reference)?.items.map(item => item.id)).toEqual([ID(3), ID(4), ID(2)])
    expect(JSON.stringify(state)).toBe(before)
  })
  it("rejects cycles, foreign scope, outside-membership links and missing plans", () => {
    const { state, plan, reference } = fixture()
    expect(readParticleWalkthrough(state, { ...reference, workspaceId: ID(888) })).toBeNull()
    expect(readParticleWalkthrough(state, { ...reference, planId: ID(888) })).toBeNull()
    plan.links = [{ source: ID(2), target: ID(3) }, { source: ID(3), target: ID(2) }]
    expect(readParticleWalkthrough(state, reference)).toBeNull()
    plan.links = [{ source: ID(888), target: ID(2) }]
    expect(readParticleWalkthrough(state, reference)).toBeNull()
  })
  it("redacts missing, hidden and foreign targets while preserving unavailable positions", () => {
    const { state, reference } = fixture()
    state.particles = state.particles.filter(item => item.id !== ID(2))
    state.particles[1].canvasHidden = true
    state.particles[2].workspaceId = ID(888)
    const route = readParticleWalkthrough(state, reference)!
    expect(route.items).toHaveLength(3)
    expect(route.items.every(item => !item.particle && !item.condition)).toBe(true)
  })
  it("shows both unresolved alternatives without choosing or completing either", () => {
    const { state, plan, reference } = fixture()
    const decision = particle(2, "decision")
    if (decision.type !== "decision") throw new Error("Expected decision")
    decision.data.outcomes = [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }]
    state.particles[1] = decision
    plan.links = [{ source: ID(2), target: ID(3), outcome: "yes" }, { source: ID(2), target: ID(4), outcome: "no" }]
    expect(readParticleWalkthrough(state, reference)?.items.slice(1).map(item => item.branch)).toEqual(["waiting", "waiting"])
    decision.data.selectedOutcome = "yes"
    const route = readParticleWalkthrough(state, reference)!
    expect(route.items.slice(1).map(item => item.branch)).toEqual(["active", "inactive"])
    expect(route.items[2].condition).toContain("No")
  })
  it("handles the 250-record cap and re-resolves current membership", () => {
    const { state, plan, reference } = fixture(249)
    expect(readParticleWalkthrough(state, reference)?.items).toHaveLength(249)
    plan.particleIds = [ID(250), ID(2)]
    expect(readParticleWalkthrough(state, reference)?.items.map(item => item.id)).toEqual([ID(250), ID(2)])
  })
  it("resolves only the selected pending proposal, never its accepted base", () => {
    const { state, objective, plan, reference } = fixture()
    objective.data.planning!.proposals.push({ ...plan, id: ID(501), planId: plan.id, baseRevision: 0, particleIds: [ID(4)], authorId: ID(502), createdAt: "2026-10-30T12:00:00Z", status: "pending" })
    const proposalRef = { ...reference, proposalId: ID(501) }
    expect(readParticleWalkthrough(state, proposalRef)?.items.map(item => item.id)).toEqual([ID(4)])
    objective.data.planning!.proposals[0].status = "rejected"
    expect(readParticleWalkthrough(state, proposalRef)).toBeNull()
  })
})
