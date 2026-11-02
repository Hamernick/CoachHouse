import { describe, expect, it } from "vitest"
import { particleSchema } from "@/features/workspace-particles/lib/particle-schema"
import { particlePlanSchema } from "@/features/workspace-particles/lib/particle-plan-schema"
import { DEFAULT_PROGRESS, summarizeObjectiveProgress, summarizePlanWork } from "@/features/workspace-particles/lib/particle-progress"
import { prepareAuthorizedParticleMutation } from "@/features/workspace-particles/lib/authorized-mutation"
import { planCommand } from "@/features/workspace-particles/lib/particle-plan-command"
import { readParticleGraph } from "@/features/workspace-particles/lib/graph-validation"
import { projectParticlePublicContent } from "@/features/workspace-particles/lib/particle-public-content"
import { duplicateParticle } from "@/features/workspace-particles/lib/particle-card-actions"
import type { Particle, ParticleGraph, ParticleOperation } from "@/features/workspace-particles/types"
import { ID, NOW, WORKSPACE, batch, graph, particle } from "./fixtures/particle-fixtures"

function objective(state: ParticleGraph) {
  const value = state.particles[0]
  if (value.type !== "objective") throw new Error("Missing objective")
  return value
}
function fixture() {
  const work = [2, 3, 4, 5].map(id => ({ ...particle(id), status: id < 4 ? "done" as const : "backlog" as const }))
  return graph([particleSchema.parse({ ...particle(1, "objective"), data: { current: 999, target: 999, unit: "", planning: {
    plans: [{ id: ID(20), revision: 0, title: "Plan", particleIds: work.map(item => item.id) }], proposals: [],
  } } }), ...work])
}
function summary(state: ParticleGraph) { return summarizeObjectiveProgress(objective(state), state.particles, Date.parse(NOW)) }
async function commit(state: ParticleGraph, operation: ParticleOperation, nonce: number, owner = true) {
  const prepared = await prepareAuthorizedParticleMutation({ input: batch(nonce, [operation], state.revision), workspaceId: WORKSPACE, canEdit: true, now: NOW,
    planningActor: { userId: ID(500), isOrganizationOwner: owner } })
  if (!prepared.ok) throw new Error(prepared.error)
  return prepared.value(state)
}
const put = (value: Particle): ParticleOperation => ({ kind: "put_particle", particle: value, expectedRevision: value.revision })

describe("approved required-work progress", () => {
  it("deduplicates work across plans and recalculates after accepted scope changes and reopening", async () => {
    let state = fixture()
    expect(summary(state).work).toMatchObject({ completed: 2, total: 4, percent: 50 })
    const original = objective(state).data.planning!.plans[0]
    state = (await commit(state, planCommand(objective(state), { ...original, id: ID(21) }), 100)).graph
    expect(summary(state).work.percent).toBe(50)
    state.particles.push(particle(6))
    state = (await commit(state, planCommand(objective(state), { ...objective(state).data.planning!.plans[0], particleIds: [...original.particleIds, ID(6)] }), 101)).graph
    expect(summary(state).work.percent).toBe(40)
    state = (await commit(state, put({ ...state.particles[1], status: "backlog" }), 102)).graph
    expect(summary(state).work.percent).toBe(20)
    const readback = readParticleGraph(JSON.parse(JSON.stringify(state)), WORKSPACE)
    expect(readback.ok && summary(readback.value).work.percent).toBe(20)
  })

  it("excludes optional/support work, proposals and unselected branches", () => {
    const state = fixture(), item = objective(state), plan = item.data.planning!.plans[0]
    state.particles.push(particle(6), particle(7, "people"), particleSchema.parse({ ...particle(8), data: { template: "task", steps: [], widget: { kind: "notes", source: { kind: "workspace", content: "Reference" } } } }))
    plan.particleIds.push(ID(6), ID(7), ID(8)); plan.optionalParticleIds = [ID(6)]
    item.data.planning!.proposals.push({ id: ID(30), planId: ID(31), baseRevision: null, title: "Proposed", particleIds: [ID(6)], authorId: ID(500), createdAt: NOW, status: "pending" })
    expect(summary(state).work.percent).toBe(50)
    const decision = particle(9, "decision")
    if (decision.type !== "decision") throw new Error("decision")
    decision.data.selectedOutcome = "yes"
    state.particles.push(decision); plan.particleIds.push(decision.id)
    plan.optionalParticleIds.push(decision.id)
    plan.links = [{ source: decision.id, target: ID(5), outcome: "no" }]
    expect(summary(state).work).toMatchObject({ completed: 2, total: 3, percent: 67 })
  })

  it("does not count containers or repeated source placements twice", () => {
    const state = fixture(), item = objective(state), plan = item.data.planning!.plans[0]
    const container = particle(6, "workflow")
    if (container.type !== "workflow") throw new Error("workflow")
    container.data.steps = [{ id: ID(40), title: "Linked work", status: "done", order: 0, particleId: ID(2) }]
    state.particles.push(container); plan.particleIds.push(container.id)
    expect(summary(state).work.total).toBe(4)
    for (const id of [7, 8]) { state.particles.push(particleSchema.parse({ ...particle(id), data: { template: "task", steps: [], source: { kind: "activity", id: ID(90) } } })); plan.particleIds.push(ID(id)) }
    expect(summary(state).work.total).toBe(5)
  })

  it("keeps zero, rounded 100, blocked work and visible-scope counts honest", () => {
    expect(summarizePlanWork([], []).percent).toBeNull()
    const items = Array.from({ length: 250 }, (_, index) => ({ ...particle(index + 1), status: index === 249 ? "blocked" as const : "done" as const }))
    const plan = { id: ID(500), revision: 0, title: "Plan", particleIds: items.map(item => item.id) }
    expect(summarizePlanWork([plan], items).percent).toBe(99)
    expect(summarizePlanWork([plan], items.slice(0, 1))).toMatchObject({ total: 1, completed: 1, visibleScope: true })
  })

  it("separates time, work and ongoing without mutating status", () => {
    const state = fixture(), item = objective(state)
    item.data.progress = { ...DEFAULT_PROGRESS, mode: "both", startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-02T00:00:00Z" }
    expect(summary(state)).toMatchObject({ percent: 50, time: { percent: 100, state: "elapsed" } })
    expect(item.status).toBe("backlog")
    item.data.progress.mode = "ongoing"
    expect(summary(state)).toMatchObject({ percent: null, label: "Ongoing", awaitingConfirmation: false })
    item.data.progress.mode = "time"
    expect(summary(state)).toMatchObject({ percent: null, label: "Period ended" })
    expect(summarizeObjectiveProgress(item, state.particles, Date.parse("2026-09-30T00:00:00Z")).time?.state).toBe("upcoming")
    item.data.progress.endsAt = null
    expect(summary(state).time).toBeNull()
  })

  it("validates modes, date ordering and optional membership references", () => {
    const item = objective(fixture())
    expect(particleSchema.safeParse({ ...item, data: { ...item.data, progress: { ...DEFAULT_PROGRESS, mode: "weighted" } } }).success).toBe(false)
    expect(particleSchema.safeParse({ ...item, data: { ...item.data, progress: { ...DEFAULT_PROGRESS, startsAt: NOW, endsAt: NOW } } }).success).toBe(false)
    expect(particlePlanSchema.safeParse({ ...item.data.planning!.plans[0], optionalParticleIds: [ID(80)] }).success).toBe(false)
  })

  it("requires authorized explicit outcome confirmation even at 100 percent, and flags later scope changes", async () => {
    let state = fixture()
    state.particles = state.particles.map(item => item.type === "objective" ? item : { ...item, status: "done" })
    expect(summary(state)).toMatchObject({ percent: 100, awaitingConfirmation: true })
    await expect(commit(state, put({ ...objective(state), status: "done" }), 103, false)).rejects.toThrow(/owner/)
    state = (await commit(state, put({ ...objective(state), status: "done" }), 104)).graph
    expect(objective(state).data.outcomeConfirmation).toMatchObject({ actorId: ID(500), at: NOW })
    expect(summary(state)).toMatchObject({ label: "Complete", scopeChanged: false })
    const changedDescription = structuredClone(state)
    objective(changedDescription).description = "Different outcome"
    expect(summary(changedDescription).scopeChanged).toBe(true)
    const changedMode = structuredClone(state)
    objective(changedMode).data.progress = { ...DEFAULT_PROGRESS, mode: "ongoing" }
    expect(summary(changedMode).scopeChanged).toBe(true)
    const publicView = projectParticlePublicContent(objective(state))
    expect(publicView.ok && publicView.value.content).toEqual({ kind: "text" })
    expect(JSON.stringify(publicView)).not.toMatch(/workIds|actorId|progress|outcomeConfirmation/)
    state.particles.push(particle(6))
    state = (await commit(state, planCommand(objective(state), { ...objective(state).data.planning!.plans[0], particleIds: [...objective(state).data.planning!.plans[0].particleIds, ID(6)] }), 105)).graph
    expect(summary(state)).toMatchObject({ label: "Complete · Review scope", scopeChanged: true })
    const confirmation = objective(state).data.outcomeConfirmation!
    await expect(commit(state, put({ ...objective(state), data: { ...objective(state).data, outcomeConfirmation: { ...confirmation, workIds: [] } } }), 106)).rejects.toThrow(/server-owned/)
    state = (await commit(state, put({ ...objective(state), status: "in_progress" }), 107)).graph
    expect(objective(state).data.outcomeConfirmation).toBeUndefined()
  })

  it("gates mode and required-work edits, conflicts and source-owned objectives", async () => {
    const state = fixture(), item = objective(state)
    const changed = { ...item, data: { ...item.data, progress: { ...DEFAULT_PROGRESS, mode: "ongoing" as const } } }
    await expect(commit(state, put(changed), 108, false)).rejects.toThrow(/owner/)
    const saved = (await commit(state, put(changed), 109)).graph
    await expect(commit(saved, put(changed), 110)).rejects.toThrow(/changed|conflict/i)
    await expect(commit(state, planCommand(item, { ...item.data.planning!.plans[0], optionalParticleIds: [ID(2)] }), 111, false)).rejects.toThrow(/owner/)
    item.data.source = { kind: "objective", id: ID(90) }
    await expect(commit(state, put({ ...item, data: { ...item.data, progress: DEFAULT_PROGRESS } }), 112)).rejects.toThrow(/source/)
  })

  it("removes detached optional-work references through the scoped command", async () => {
    let state = fixture(), item = objective(state)
    const plan = { ...item.data.planning!.plans[0], optionalParticleIds: [ID(2)] }
    state = (await commit(state, planCommand(item, plan), 113)).graph
    item = objective(state)
    state = (await commit(state, { kind: "change_plan", objectiveId: item.id, expectedRevision: item.revision, planId: plan.id, expectedPlanRevision: item.data.planning!.plans[0].revision, change: { kind: "detach_particle", particleId: ID(2) } }, 114)).graph
    expect(objective(state).data.planning!.plans[0].optionalParticleIds).toEqual([])
  })

  it("duplicates an objective without copying outcome confirmation", async () => {
    const saved = (await commit(fixture(), put({ ...objective(fixture()), status: "done" }), 115)).graph
    const copy = duplicateParticle(objective(saved), () => ID(99), NOW)
    expect(copy.status).toBe("backlog")
    expect(copy.type === "objective" && copy.data.outcomeConfirmation).toBeUndefined()
  })
})
