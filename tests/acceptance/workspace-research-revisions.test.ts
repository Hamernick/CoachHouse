import { describe, expect, it } from "vitest"
import { bindResearch } from "@/features/workspace-ai/lib/research-contract"
import type { ResearchResult } from "@/features/workspace-ai/research-types"
import { researchPlanOperations } from "@/features/workspace-particles/lib/research-plan"
import { prepareAuthorizedParticleMutation } from "@/features/workspace-particles/lib/authorized-mutation"
import { planFromProposal } from "@/features/workspace-particles/lib/particle-plan-schema"
import type { ParticleGraph, ParticleOperation } from "@/features/workspace-particles/types"
import { graph, particle, batch, ID, WORKSPACE, NOW } from "./fixtures/particle-fixtures"

const actor = { userId: ID(90), isOrganizationOwner: true }
function fixture() {
  const objective = particle(1, "objective"), decision = particle(5, "decision")
  if (objective.type !== "objective" || decision.type !== "decision") throw Error()
  decision.data.outcomes = [{ id: "yes", label: "Available" }, { id: "no", label: "Unavailable" }]
  decision.data.selectedOutcome = "yes"
  objective.data.planning = { plans: [{ id: ID(10), revision: 0, title: "Accepted work", particleIds: [ID(2), ID(3), ID(4), ID(5)], links: [{ source: ID(2), target: ID(3) }, { source: ID(3), target: ID(4) }, { source: ID(5), target: ID(2), outcome: "yes" }], researchRunId: ID(70) }], proposals: [] }
  return graph([objective, { ...particle(2), title: "Keep original", description: "Original contents", status: "done" }, particle(3), particle(4), decision])
}
const source = (id: number) => ({ id: `particle:${ID(id)}`, kind: "workspace" as const, title: "Existing", href: "/workspace", revision: "0", checkedAt: NOW })
const reference = (id: number, dependsOn: string[] = []) => ({ key: `item${id}`, kind: "reference" as const, title: "AI replacement title", description: "AI replacement content", referenceId: source(id).id, evidenceIds: [source(id).id], dependsOn })
function result(extra: Partial<ResearchResult> = {}): ResearchResult {
  return { title: "Revised plan", summary: "Proposed change", questions: [], decisions: [], removeReferences: [], items: [], sources: [source(2), source(3), source(4), source(5)], target: { organizationId: WORKSPACE, objectiveId: ID(1), revision: 0, plan: { id: ID(10), revision: 0 } }, runId: ID(71), ...extra }
}
function operations(before: ParticleGraph, research: ResearchResult) {
  let next = 100
  return researchPlanOperations(before, research, actor.userId, NOW, () => ID(next++))
}
function proposalOf(value: ParticleGraph) {
  const objective = value.particles.find(item => item.id === ID(1))!
  if (objective.type !== "objective") throw Error()
  return { objective, proposal: objective.data.planning!.proposals[0] }
}
async function write(before: ParticleGraph, ops: ParticleOperation[], owner = true, researchRunId?: string) {
  const prepared = await prepareAuthorizedParticleMutation({ input: batch(200 + before.revision, ops, before.revision), workspaceId: WORKSPACE, canEdit: true, now: NOW, planningActor: { ...actor, isOrganizationOwner: owner }, authorizedResearch: researchRunId ? { runId: researchRunId, objectiveId: ID(1) } : undefined })
  if (!prepared.ok) throw Error(prepared.error)
  return prepared.value(JSON.parse(JSON.stringify(before))).graph
}
function review(before: ParticleGraph, status: "accepted" | "rejected" = "accepted"): ParticleOperation[] {
  const { objective, proposal } = proposalOf(before)
  return [{ kind: "put_particle", expectedRevision: objective.revision, particle: { ...objective, data: { ...objective.data, planning: { plans: status === "accepted" ? [planFromProposal(proposal)] : objective.data.planning!.plans, proposals: [{ ...proposal, status, reviewedBy: actor.userId, reviewedAt: NOW }] } } } }]
}

describe("partial research plan revisions", () => {
  it("preserves accepted particles, status and untouched links; acceptance changes plan provenance atomically", async () => {
    const before = fixture(), research = result({ items: [reference(2), { key: "added", title: "New work", kind: "note", description: "Proposed", referenceId: null, evidenceIds: [], dependsOn: ["item2"] }] })
    const saved = await write(before, operations(before, research), false, research.runId)
    const { objective, proposal } = proposalOf(saved)
    expect(objective.data.planning!.plans).toEqual(proposalOf(before).objective.data.planning!.plans)
    expect(proposal).toMatchObject({ planId: ID(10), baseRevision: 0, status: "pending" })
    expect(proposal.particleIds).toEqual([ID(2), ID(3), ID(4), ID(5), ID(100)])
    expect(proposal.links).toContainEqual({ source: ID(3), target: ID(4) })
    expect(saved.particles.find(item => item.id === ID(2))).toEqual(before.particles[1])
    expect(saved.particles.find(item => item.id === ID(100))!.status).toBe("backlog")
    await expect(write(saved, review(saved), false)).rejects.toThrow(/owner/)
    const accepted = await write(saved, review(saved))
    expect(proposalOf(accepted).objective.data.planning!.plans[0].researchRunId).toBe(research.runId)
    expect(operations(accepted, research)).toEqual([])
  })
  it("allows removal-only proposals, deleting incident links but never canvas particles", async () => {
    const before = fixture(), research = result({ removeReferences: [source(3).id] })
    const saved = await write(before, operations(before, research), true, research.runId)
    const { proposal } = proposalOf(saved)
    expect(proposal.particleIds).toEqual([ID(2), ID(4), ID(5)])
    expect(proposal.links).toEqual([{ source: ID(5), target: ID(2), outcome: "yes" }])
    expect(saved.particles.find(item => item.id === ID(3))).toEqual(before.particles[2])
    const accepted = await write(saved, review(saved))
    expect(accepted.particles.some(item => item.id === ID(3))).toBe(true)
  })
  it.each(["unknown", "duplicate", "contradictory", "new plan"])("rejects %s removals", kind => {
    const research = result({ removeReferences: [source(2).id] })
    if (kind === "unknown") research.removeReferences = [source(9).id]
    if (kind === "duplicate") research.removeReferences!.push(source(2).id)
    if (kind === "contradictory") research.items = [reference(2)]
    if (kind === "new plan") delete research.target.plan
    expect(() => operations(fixture(), research)).toThrow()
  })
  it("replaces only returned references' incoming unconditional links", () => {
    const ops = operations(fixture(), result({ items: [reference(3)] }))
    const last = ops.at(-1)!
    if (last.kind !== "put_particle" || last.particle.type !== "objective") throw Error()
    expect(last.particle.data.planning!.proposals[0].links).toEqual([{ source: ID(3), target: ID(4) }, { source: ID(5), target: ID(2), outcome: "yes" }])
  })
  it("rejects a cycle that appears only after merging with untouched dependencies", () => {
    // Generated 2 -> 4 is acyclic; preserved 4 -> 5 -> 2 closes the cycle.
    const before = fixture(), { objective } = proposalOf(before)
    objective.data.planning!.plans[0].links!.push({ source: ID(4), target: ID(5) })
    expect(() => operations(before, result({ items: [reference(2), reference(4, ["item2"])] }))).toThrow(/cycle/)
  })
  it("rejects unconditional dependencies that conflict with preserved conditional branches", () => {
    expect(() => operations(fixture(), result({ items: [reference(5), reference(2, ["item5"])] }))).toThrow(/unconditional/)
  })
  it("requires matching original decision outcomes at binding and again against the graph", async () => {
    const research = result({ items: [reference(5), reference(4)], decisions: [{ itemKey: "item5", outcomes: [{ key: "yes", label: "Available", next: ["item4"] }, { key: "no", label: "Unavailable", next: [] }] }] })
    const { sources, target, runId, ...generated } = research
    expect(() => bindResearch(JSON.stringify(generated), sources, target, runId)).toThrow(/outcomes/)
    const outcomes = new Map([[source(5).id, [{ id: "yes", label: "Available" }, { id: "no", label: "Unavailable" }]]])
    expect(bindResearch(JSON.stringify(generated), sources, target, runId, outcomes).decisions).toEqual(research.decisions)
    const before = fixture(), saved = await write(before, operations(before, research), true, runId)
    expect(saved.particles.find(item => item.id === ID(5))).toEqual(before.particles[4])
    expect(proposalOf(saved).proposal.links!.filter(link => link.outcome)).toEqual([{ source: ID(5), target: ID(4), outcome: "yes" }])
    research.decisions![0].outcomes[0].label = "Different meaning"
    expect(() => operations(before, research)).toThrow(/outcomes/)
    research.decisions![0].outcomes[0] = { key: "invented", label: "Available", next: ["item4"] }
    expect(() => operations(before, research)).toThrow(/outcomes/)
  })
  it("accepts up to twelve existing outcomes while keeping newly generated decisions bounded", () => {
    const outcomes = Array.from({ length: 12 }, (_, index) => ({ id: `outcome${index}`, label: `Option ${index}` }))
    const research = result({ items: [reference(5)], decisions: [{ itemKey: "item5", outcomes: outcomes.map(value => ({ key: value.id, label: value.label, next: [] })) }] })
    const before = fixture(), decision = before.particles.find(item => item.type === "decision")!
    if (decision.type !== "decision") throw Error()
    decision.data.outcomes = outcomes; decision.data.selectedOutcome = "outcome0"
    proposalOf(before).objective.data.planning!.plans[0].links!.find(link => link.outcome)!.outcome = "outcome0"
    expect(() => operations(before, research)).not.toThrow()
    research.items[0] = { ...reference(5), kind: "decision", referenceId: null }
    expect(() => operations(before, research)).toThrow(/six outcomes/)
  })
  it("applies legacy runs with absent metadata using unselected default decisions", async () => {
    const research = result({ items: [{ key: "legacy", kind: "decision", title: "Choose", description: "Old proposal", referenceId: null, evidenceIds: [], dependsOn: [] }] })
    delete research.target.plan; delete research.decisions; delete research.removeReferences
    const before = fixture(), saved = await write(before, operations(before, research), true, research.runId)
    const decision = saved.particles.find(item => item.id === ID(100))!
    expect(decision.type).toBe("decision")
    if (decision.type !== "decision") throw Error()
    expect(decision.data.selectedOutcome).toBeNull()
    expect(decision.data.outcomes).toEqual([{ id: "yes", label: "Yes" }, { id: "no", label: "Not yet" }])
    research.decisions = []
    expect(() => operations(before, research)).toThrow(/declared outcomes/)
  })
  it("preserves evidence and fails clearly when a revision would exceed the source limit", () => {
    const before = fixture(), { objective } = proposalOf(before)
    objective.data.planning!.plans[0].sources = Array.from({ length: 40 }, (_, index) => source(index + 300))
    expect(() => operations(before, result({ items: [reference(2)] }))).toThrow(/40-source limit/)
  })
  it("rejects stale plan revisions, stale acceptance and forged provenance; rejected revisions keep work intact", async () => {
    const before = fixture(), research = result({ items: [reference(2)] })
    research.target.plan!.revision = 1
    expect(() => operations(before, research)).toThrow(/Plan changed/)
    research.target.plan!.revision = 0
    await expect(write(before, operations(before, research))).rejects.toThrow(/saved proposal/)
    const saved = await write(before, operations(before, research), true, research.runId)
    const forged = structuredClone(saved), { objective } = proposalOf(forged)
    objective.data.planning!.plans[0].researchRunId = research.runId
    await expect(write(saved, [{ kind: "put_particle", particle: objective, expectedRevision: objective.revision }])).rejects.toThrow(/origin/)
    const concurrent = structuredClone(saved)
    proposalOf(concurrent).objective.data.planning!.plans[0].revision = concurrent.revision
    await expect(write(concurrent, review(concurrent))).rejects.toThrow(/changed|origin/)
    const rejected = await write(saved, review(saved, "rejected"))
    expect(proposalOf(rejected).objective.data.planning!.plans).toEqual(proposalOf(before).objective.data.planning!.plans)
    expect(operations(rejected, research)).toEqual([])
  })
})
