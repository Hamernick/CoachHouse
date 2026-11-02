import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { useParticlePlans, type PlanningControls } from "@/features/workspace-objectives/hooks/use-particle-plans"
import { PARTICLE_PRESETS } from "@/features/workspace-particles/lib/particle-presets"

vi.mock("@/features/workspace-objectives/actions", () => ({ objectivePlanningAccessAction: vi.fn() }))
import { planCommand } from "@/features/workspace-particles/lib/particle-plan-command"
import { prepareAuthorizedParticleMutation } from "@/features/workspace-particles/lib/authorized-mutation"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { readParticleGraph } from "@/features/workspace-particles/lib/graph-validation"
import { getParticleNotes } from "@/features/workspace-particles/lib/particle-notes"
import { particleSchema } from "@/features/workspace-particles/lib/particle-schema"
import { createParticleHistory } from "@/features/workspace-particles/lib/particle-history"
import type { ParticleGraph, ParticleOperation } from "@/features/workspace-particles/types"
import { ID, NOW, WORKSPACE, batch, graph, particle } from "./fixtures/particle-fixtures"

function objective(state: ParticleGraph, id = 1) {
  const item = state.particles.find(value => value.id === ID(id))
  if (item?.type !== "objective") throw new Error("Missing objective")
  return item
}
function plan(state: ParticleGraph, objectiveId = 1) {
  return objective(state, objectiveId).data.planning!.plans[0]
}
function fixture() {
  const note = particleSchema.parse({ ...particle(2), data: { template: "task", steps: [],
    widget: { kind: "notes", source: { kind: "workspace", content: "Original note" } } } })
  return graph([particle(1, "objective"), note, particle(3), particle(4, "objective")])
}
async function commit(state: ParticleGraph, operation: ParticleOperation, id: number, owner = true) {
  const prepared = await prepareAuthorizedParticleMutation({ input: batch(id, [operation], state.revision),
    workspaceId: WORKSPACE, canEdit: true, now: NOW,
    planningActor: { userId: ID(500), isOrganizationOwner: owner } })
  if (!prepared.ok) throw new Error(prepared.error)
  return prepared.value(state)
}
async function setup() {
  const initial = fixture()
  const first = await commit(initial, planCommand(objective(initial), { id: ID(20), revision: 0, title: "First", particleIds: [ID(2), ID(3)] }), 100)
  return (await commit(first.graph, planCommand(objective(first.graph, 4), { id: ID(21), revision: 0, title: "Second", particleIds: [] }), 101)).graph
}

describe("manual plan commands through the authorized graph writer", () => {
  it("reuses one canonical note, edits it, detaches only one membership, and reloads", async () => {
    let saved = await setup()
    const second = { ...plan(saved, 4), particleIds: [ID(2)] }
    const reuse = planCommand(objective(saved, 4), second)
    expect(reuse.change.kind).toBe("reuse_particle")
    saved = (await commit(saved, reuse, 102)).graph
    const note = saved.particles.find(item => item.id === ID(2))!
    if (note.type !== "activity") throw new Error("Missing note")
    saved = (await commit(saved, { kind: "put_particle", expectedRevision: note.revision,
      particle: { ...note, data: { ...note.data, widget: { kind: "notes", source: { kind: "workspace", content: "Edited once" } } } } }, 103)).graph
    for (const id of [1, 4]) {
      const sourceId = plan(saved, id).particleIds[0]
      expect(getParticleNotes(saved.particles.find(item => item.id === sourceId)!)).toMatchObject({ content: "Edited once" })
    }
    const beforeSecond = plan(saved, 4)
    const detach = planCommand(objective(saved), { ...plan(saved), particleIds: [ID(3)] })
    expect(detach.change.kind).toBe("detach_particle")
    saved = (await commit(saved, detach, 104)).graph
    const reloaded = readParticleGraph(JSON.parse(JSON.stringify(saved)), WORKSPACE)
    expect(reloaded.ok).toBe(true)
    if (!reloaded.ok) throw new Error(reloaded.error)
    expect(plan(reloaded.value).particleIds).toEqual([ID(3)])
    expect(plan(reloaded.value, 4)).toEqual(beforeSecond)
    expect(reloaded.value.particles.filter(item => item.id === ID(2))).toHaveLength(1)
  })

  it("rejects stale commands and non-owner accepted-plan writes", async () => {
    const saved = await setup()
    const rename = planCommand(objective(saved), { ...plan(saved), title: "Changed" })
    expect(rename.change.kind).toBe("edit_plan")
    await expect(commit(saved, rename, 105, false)).rejects.toThrow(/owner/)
    const changed = (await commit(saved, rename, 105)).graph
    await expect(commit(changed, rename, 106)).rejects.toThrow(/changed/)
    const wrongPlanRevision = { ...planCommand(objective(changed), plan(changed)), expectedPlanRevision: 0 }
    await expect(commit(changed, wrongPlanRevision, 107)).rejects.toThrow(/changed/)
  })

  it("reorders only members and keeps source content and unrelated objective fields", async () => {
    const saved = await setup()
    const beforeSources = saved.particles.filter(item => item.type !== "objective")
    const command = planCommand(objective(saved), { ...plan(saved), particleIds: [ID(3), ID(2)] })
    expect(command.change.kind).toBe("reorder_plan")
    const result = await commit(saved, command, 108)
    expect(plan(result.graph).particleIds).toEqual([ID(3), ID(2)])
    expect(result.graph.particles.filter(item => item.type !== "objective")).toEqual(beforeSources)
    expect(objective(result.graph).data.target).toEqual(objective(saved).data.target)
    await expect(commit(saved, { ...command, change: { kind: "reorder_plan", particleIds: [ID(2), ID(99)] } }, 109)).rejects.toThrow(/Invalid/)
    await expect(commit(saved, { ...command, change: { kind: "reuse_particle", particleId: ID(99), index: 0 } }, 110)).rejects.toThrow(/existing/)
    await expect(commit(saved, { ...command, change: { kind: "reuse_particle", particleId: ID(4), index: 0 } }, 111)).rejects.toThrow(/existing/)
  })

  it("replays a lost response once and preserves undo/redo", async () => {
    const saved = await setup()
    const command = planCommand(objective(saved), { ...plan(saved), particleIds: [ID(3)] })
    const input = batch(112, [command], saved.revision)
    const result = await commit(saved, command, 112)
    const prepared = await prepareAuthorizedParticleMutation({ input, workspaceId: WORKSPACE, canEdit: true, now: NOW,
      planningActor: { userId: ID(500), isOrganizationOwner: true } })
    if (!prepared.ok) throw new Error(prepared.error)
    expect(prepared.value(result.graph)).toMatchObject({ replayed: true, graph: result.graph })
    const history = createParticleHistory(WORKSPACE)
    history.observe(saved)
    history.committed(input, result)
    const undo = history.prepare("undo", result.graph, ID(113))!
    const reverted = await applyParticleBatch(result.graph, undo, NOW)
    if (!reverted.ok) throw new Error(reverted.error)
    expect(plan(reverted.value.graph).particleIds).toEqual([ID(2), ID(3)])
    history.committed(undo, reverted.value, "undo")
    const redo = history.prepare("redo", reverted.value.graph, ID(114))!
    const reapplied = await applyParticleBatch(reverted.value.graph, redo, NOW)
    if (!reapplied.ok) throw new Error(reapplied.error)
    expect(plan(reapplied.value.graph).particleIds).toEqual([ID(3)])
  })

  it("retains legacy graph data and rejects cross-workspace or read-only commands", async () => {
    const saved = await setup()
    expect(readParticleGraph(JSON.parse(JSON.stringify(saved)), WORKSPACE)).toMatchObject({ ok: true })
    const input = batch(115, [planCommand(objective(saved), { ...plan(saved), title: "Rename" })], saved.revision)
    expect(await prepareAuthorizedParticleMutation({ input, workspaceId: WORKSPACE, canEdit: false, now: NOW })).toMatchObject({ ok: false, code: "scope" })
    expect(await prepareAuthorizedParticleMutation({ input, workspaceId: ID(998), canEdit: true, now: NOW })).toMatchObject({ ok: false, code: "scope" })
  })
})

it("manual plan controls atomically create a note and reuse it through the command writer", async () => {
  let saved = await setup()
  const commitControl = vi.fn(async (operations: ParticleOperation[]) => {
    const prepared = await prepareAuthorizedParticleMutation({ input: batch(120 + saved.revision, operations, saved.revision),
      workspaceId: WORKSPACE, canEdit: true, now: NOW, planningActor: { userId: ID(500), isOrganizationOwner: true } })
    if (!prepared.ok) return false
    saved = prepared.value(saved).graph
    return true
  })
  const controls = { getCurrentGraph: () => saved, flow: { current: null }, commit: commitControl } as unknown as PlanningControls
  let actions!: ReturnType<typeof useParticlePlans>
  function Harness() { actions = useParticlePlans({ userId: ID(500), organizationId: WORKSPACE }, controls); return null }
  renderToStaticMarkup(createElement(Harness))
  const preset = PARTICLE_PRESETS.find(item => item.id === "notes")!
  const note = actions.create(objective(saved), preset)
  expect(await actions.savePlan(objective(saved), { ...plan(saved), particleIds: [...plan(saved).particleIds, note.id] }, note)).toBe(true)
  expect(commitControl.mock.calls[0][0].map(item => item.kind)).toEqual(["put_particle", "change_plan"])
  expect(getParticleNotes(saved.particles.find(item => item.id === note.id)!)).toMatchObject({ kind: "workspace" })
  expect(await actions.savePlan(objective(saved, 4), { ...plan(saved, 4), particleIds: [note.id] })).toBe(true)
  expect(commitControl.mock.calls[1][0]).toHaveLength(1)
  expect(commitControl.mock.calls[1][0][0]).toMatchObject({ kind: "change_plan", change: { kind: "reuse_particle", particleId: note.id } })
  expect(saved.particles.filter(item => item.id === note.id)).toHaveLength(1)
  commitControl.mockResolvedValueOnce(false)
  const beforeFailure = JSON.stringify(saved)
  expect(await actions.savePlan(objective(saved), { ...plan(saved), title: "Unsaved edit" })).toBe(false)
  expect(JSON.stringify(saved)).toBe(beforeFailure)
})


describe("contextual plan responsibility", () => {
  const responsibility = { version: 1 as const, ownerId: ID(701), contributorIds: [ID(702)] }
  it("assigns only one use, increments its plan revision, reloads and rejects stale or non-owner edits", async () => {
    let saved = await setup()
    saved = (await commit(saved, planCommand(objective(saved, 4), { ...plan(saved, 4), particleIds: [ID(2)] }), 800)).graph
    const beforeOther = plan(saved, 4), beforeWork = saved.particles.find(item => item.id === ID(2))
    const oldRevision = plan(saved).revision
    const command = planCommand(objective(saved), { ...plan(saved), assignments: [{ particleId: ID(2), responsibility }] })
    expect(command.change.kind).toBe("edit_plan")
    await expect(commit(saved, command, 801, false)).rejects.toThrow(/owner/)
    saved = (await commit(saved, command, 801)).graph
    expect(plan(saved).revision).toBeGreaterThan(oldRevision)
    expect(plan(saved, 4)).toEqual(beforeOther)
    expect(saved.particles.find(item => item.id === ID(2))).toEqual(beforeWork)
    expect(readParticleGraph(JSON.parse(JSON.stringify(saved)), WORKSPACE)).toMatchObject({ ok: true, value: saved })
    await expect(commit(saved, command, 802)).rejects.toThrow(/changed/)
    const detached = await commit(saved, { ...planCommand(objective(saved), plan(saved)), change: { kind: "detach_particle", particleId: ID(2) } }, 803)
    expect(plan(detached.graph).assignments).toEqual([])
    expect(plan(detached.graph, 4)).toEqual(beforeOther)
  })
  it("rejects duplicate/nonmember assignments before saving", async () => {
    const saved = await setup()
    for (const assignments of [[{ particleId: ID(99), responsibility }], [{ particleId: ID(2), responsibility }, { particleId: ID(2), responsibility }]]) {
      await expect(commit(saved, planCommand(objective(saved), { ...plan(saved), assignments }), 804)).rejects.toThrow()
    }
  })
  it("copies assignments into proposals and requires accepted contents to match review", async () => {
    let saved = await setup()
    const proposed = { id: ID(810), planId: plan(saved).id, baseRevision: plan(saved).revision, title: plan(saved).title,
      particleIds: plan(saved).particleIds, assignments: [{ particleId: ID(2), responsibility }], authorId: ID(500), createdAt: NOW, status: "pending" as const }
    const original = objective(saved)
    saved = (await commit(saved, { kind: "put_particle", expectedRevision: original.revision, particle: { ...original, data: { ...original.data, planning: { plans: [plan(saved)], proposals: [proposed] } } } }, 811, false)).graph
    const current = objective(saved)
    const review = { ...proposed, status: "accepted" as const, reviewedBy: ID(500), reviewedAt: NOW }
    const write = (include: boolean): ParticleOperation => ({ kind: "put_particle", expectedRevision: current.revision,
      particle: { ...current, data: { ...current.data, planning: { plans: [{ ...plan(saved), ...(include ? { assignments: proposed.assignments } : {}) }], proposals: [review] } } } })
    await expect(commit(saved, write(false), 812)).rejects.toThrow(/together/)
    const accepted = await commit(saved, write(true), 813)
    expect(plan(accepted.graph).assignments).toEqual(proposed.assignments)
  })
})
