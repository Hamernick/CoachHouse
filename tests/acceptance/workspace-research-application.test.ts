import { beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ID, WORKSPACE, NOW, graph, particle } from "./fixtures/particle-fixtures"
import type { ResearchResult } from "@/features/workspace-ai/research-types"
import type { ParticleCommit, ParticleResult } from "@/features/workspace-particles/types"
import { particlePlanningPermissionError } from "@/features/workspace-particles/lib/particle-plan-authority"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { prepareAuthorizedParticleMutation } from "@/features/workspace-particles/lib/authorized-mutation"
import { useParticleSession } from "@/features/workspace-particles/hooks/use-particle-session"
const mocks = vi.hoisted(() => ({ context: vi.fn(), read: vi.fn(), load: vi.fn(), write: vi.fn() }))
vi.mock("@/features/workspace-ai/server/research-context", () => ({ loadResearchContext: mocks.context }))
vi.mock("@/features/ai-credits", () => ({ readAiRun: mocks.read }))
vi.mock("@/features/workspace-ai/server/knowledge-records", () => ({ knowledgeLoader: () => mocks.load }))
vi.mock("@/features/workspace-ai/server", async () => ({ prepareResearchApplication: (await import("@/features/workspace-ai/server/research-application")).prepareResearchApplication }))
vi.mock("@/app/(dashboard)/my-organization/_lib/workspace-particle-write", () => ({ writeWorkspaceParticleBatch: mocks.write }))
import { applyWorkspaceResearchAction } from "@/app/(dashboard)/my-organization/_lib/workspace-research-actions"
import { prepareResearchApplication } from "@/features/workspace-ai/server/research-application"
const target = { organizationId: WORKSPACE, objectiveId: ID(1), revision: 0 }
const input = { organizationId: WORKSPACE, objectiveId: ID(1), runId: ID(8) }
const before = graph([particle(1, "objective")])
function result(): ResearchResult {
  return { runId: ID(8), target, title: "Saved research", summary: "Evidence-backed proposal", questions: [], decisions: [], sources: [],
    items: [{ key: "first", kind: "note", title: "Confirm availability", description: "Ask the venue", referenceId: null, evidenceIds: [], dependsOn: [] }] }
}
function run(value = result()) {
  return { id: ID(8), status: "succeeded", target: { ...value.target, kind: "particle_research", userId: ID(90), canvasId: null }, proposal: JSON.stringify(value), charged_credits: 2, cancel_requested_at: null }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.context.mockResolvedValue({ user: { id: ID(90) }, graph: before, objective: before.particles[0], canvasId: null })
  mocks.read.mockResolvedValue(run())
  mocks.load.mockResolvedValue([])
})
describe("server-owned research application", () => {
  it("builds a pending proposal only from the actor's saved result", async () => {
    const prepared = await prepareResearchApplication(input)
    expect(mocks.read).toHaveBeenCalledWith(ID(8), WORKSPACE, ID(90))
    expect(prepared.batch).toMatchObject({ workspaceId: WORKSPACE, baseRevision: 0, requireExactRevision: true })
    const operation = prepared.batch!.operations.at(-1)!
    expect(operation.kind === "put_particle" && operation.particle.type === "objective" && operation.particle.data.planning?.proposals[0]).toMatchObject({ title: "Saved research", authorId: ID(90), status: "pending", researchRunId: ID(8) })
  })
  it("routes the default canvas through the canonical writer and refuses a different canvas", async () => {
    mocks.write.mockResolvedValue({ ok: true, value: { graph: before, inverse: [], replayed: false } })
    expect((await applyWorkspaceResearchAction(input)).ok).toBe(true)
    expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({ requireExactRevision: true }), undefined, { runId: ID(8), objectiveId: ID(1) })
    mocks.write.mockClear()
    expect(await applyWorkspaceResearchAction(input, ID(50))).toMatchObject({ ok: false, code: "scope" })
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it("rejects client-supplied result content before reading private records", async () => {
    await expect(prepareResearchApplication({ ...input, result: result() })).rejects.toThrow()
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it.each(["actor", "canvas", "objective", "organization", "unfinished", "run", "provenance"])("rejects %s mismatches", async kind => {
    const value = run()
    if (kind === "actor") value.target.userId = ID(91)
    if (kind === "canvas") Object.assign(value.target, { canvasId: ID(92) })
    if (kind === "objective") value.target.objectiveId = ID(92)
    if (kind === "organization") value.target.organizationId = ID(92)
    if (kind === "unfinished") value.status = "running"
    if (kind === "run") value.id = ID(92)
    if (kind === "provenance") value.proposal = JSON.stringify({ ...result(), runId: ID(92) })
    mocks.read.mockResolvedValue(value)
    await expect(prepareResearchApplication(input)).rejects.toThrow()
  })
  it("refuses stale objectives without overwriting their edits", async () => {
    const changed = structuredClone(before); changed.particles[0].revision++
    mocks.context.mockResolvedValue({ user: { id: ID(90) }, graph: changed, objective: changed.particles[0], canvasId: null })
    await expect(prepareResearchApplication(input)).rejects.toThrow(/Objective changed/)
  })
  it("rechecks private evidence access and revision", async () => {
    const value = result()
    value.sources = [{ id: `person:${ID(20)}`, title: "Venue contact", href: "/workspace", revision: "v1", kind: "workspace", checkedAt: NOW }]
    value.items[0].evidenceIds = [value.sources[0].id]
    mocks.read.mockResolvedValue(run(value))
    await expect(prepareResearchApplication(input)).rejects.toThrow(/source changed/)
    mocks.load.mockResolvedValue([{ id: value.sources[0].id, revision: "v2" }])
    await expect(prepareResearchApplication(input)).rejects.toThrow(/source changed/)
    mocks.load.mockResolvedValue([{ id: value.sources[0].id, revision: "v1" }])
    expect((await prepareResearchApplication(input)).batch).not.toBeNull()
  })
  it("replays from durable proposal history after graph receipts expire", async () => {
    const prepared = await prepareResearchApplication(input)
    const saved = await applyParticleBatch(before, prepared.batch!, NOW)
    if (!saved.ok) throw Error(saved.error)
    const current = { ...saved.value.graph, receipts: [] }
    mocks.context.mockResolvedValue({ user: { id: ID(90) }, graph: current, objective: current.particles.find(item => item.id === ID(1)), canvasId: null })
    expect((await prepareResearchApplication(input)).batch).toBeNull()
    expect(mocks.load).not.toHaveBeenCalled()
  })
  it("keeps research origin immutable when humans edit proposals and accepted plans", async () => {
    const prepared = await prepareResearchApplication(input)
    const saved = await applyParticleBatch(before, prepared.batch!, NOW)
    if (!saved.ok) throw Error(saved.error)
    const original = saved.value.graph, edited = structuredClone(original)
    const objective = edited.particles.find(item => item.type === "objective")!
    if (objective.type !== "objective") throw Error()
    objective.data.planning!.proposals[0].researchRunId = undefined
    expect(particlePlanningPermissionError(original, edited, { userId: ID(90), isOrganizationOwner: true }, NOW)).toMatch(/research origin/)
    const plan = { id: ID(50), title: "Accepted", revision: 0, particleIds: [], researchRunId: ID(8) }
    const accepted = structuredClone(before), changed = structuredClone(before)
    for (const [value, researchRunId] of [[accepted, ID(8)], [changed, undefined]] as const) {
      const item = value.particles[0]
      if (item.type === "objective") item.data.planning = { plans: [{ ...plan, researchRunId }], proposals: [] }
    }
    expect(particlePlanningPermissionError(accepted, changed, { userId: ID(90), isOrganizationOwner: true }, NOW)).toMatch(/research origin/)
  })
  it("blocks fabricated provenance through the generic writer; the internal path remains revision fenced", async () => {
    const prepared = await prepareResearchApplication(input)
    const args = { input: prepared.batch, workspaceId: WORKSPACE, canEdit: true, now: NOW, planningActor: { userId: ID(90), isOrganizationOwner: true } }
    const untrusted = await prepareAuthorizedParticleMutation(args)
    if (!untrusted.ok) throw Error(untrusted.error)
    expect(() => untrusted.value(before)).toThrow(/saved proposal/)
    const trusted = await prepareAuthorizedParticleMutation({ ...args, authorizedResearch: { runId: ID(8), objectiveId: ID(1) } })
    if (!trusted.ok) throw Error(trusted.error)
    expect(trusted.value(before).graph.particles).toHaveLength(2)
    expect(() => trusted.value({ ...before, revision: before.revision + 1 })).toThrow()
  })
})

describe("research application session", () => {
  it("serializes saves and publishes only the acknowledged graph; retry uses the same run", async () => {
    let resolve!: (value: ParticleResult<ParticleCommit>) => void
    const transport = vi.fn<(value: typeof input) => Promise<ParticleResult<ParticleCommit>>>(() => new Promise(done => { resolve = done }))
    let session!: ReturnType<typeof useParticleSession>
    function Harness() {
      session = useParticleSession({ workspaceId: WORKSPACE, stored: before, canEdit: true, transport: vi.fn(), researchTransport: transport, load: async () => ({ ok: true, value: before }) })
      return null
    }
    renderToStaticMarkup(createElement(Harness))
    const first = session.applyResearch(ID(8), ID(1))
    expect(await session.applyResearch(ID(8), ID(1))).toBeNull()
    expect(await session.commit([])).toBe(false)
    expect(session.getCurrentGraph()).toEqual(before)
    resolve({ ok: false, code: "unavailable", error: "Interrupted" })
    expect(await first).toBeNull()
    const retry = session.applyResearch(ID(8), ID(1))
    const saved = { graph: { ...before, revision: 1 }, inverse: [], replayed: true }
    resolve({ ok: true, value: saved })
    expect(await retry).toEqual(saved)
    expect(session.getCurrentGraph()?.revision).toBe(1)
    expect(transport.mock.calls.map(call => call[0])).toEqual([input, input])
  })
})

describe("server-owned revision application", () => {
  function revision() {
    const objective = particle(1, "objective"), member = particle(2)
    if (objective.type !== "objective") throw Error()
    objective.data.planning = { plans: [{ id: ID(50), revision: 2, title: "Accepted", particleIds: [member.id] }], proposals: [] }
    const current = { ...graph([objective, member]), revision: 2 }
    const value: ResearchResult = { ...result(), target: { ...target, plan: { id: ID(50), revision: 2 } }, items: [], removeReferences: [`particle:${member.id}`], sources: [{ id: `particle:${member.id}`, title: member.title, href: "/workspace", revision: "0", checkedAt: NOW, kind: "workspace" }] }
    mocks.context.mockResolvedValue({ user: { id: ID(90) }, graph: current, objective, canvasId: null })
    mocks.read.mockResolvedValue(run(value))
    mocks.load.mockResolvedValue([{ id: `particle:${member.id}`, revision: "0" }])
    return { current, objective, value }
  }
  it("applies saved removals as membership changes and checks the removed source revision", async () => {
    revision()
    const prepared = await prepareResearchApplication(input)
    const operation = prepared.batch!.operations.at(-1)!
    expect(operation.kind === "put_particle" && operation.particle.type === "objective" && operation.particle.data.planning?.proposals[0]).toMatchObject({ planId: ID(50), baseRevision: 2, particleIds: [] })
    expect(prepared.batch!.operations).toHaveLength(1)
    mocks.load.mockResolvedValue([{ id: `particle:${ID(2)}`, revision: "1" }])
    await expect(prepareResearchApplication(input)).rejects.toThrow(/source changed/)
  })
  it("rejects changed plan revisions even when objective revision still matches", async () => {
    const { objective } = revision()
    objective.data.planning!.plans[0].revision++
    await expect(prepareResearchApplication(input)).rejects.toThrow(/plan changed/i)
  })
  it.each(["missing", "id", "revision"])("rejects %s plan provenance before application", async kind => {
    const { value } = revision(), saved = run(value)
    if (kind === "missing") delete saved.target.plan
    else saved.target.plan = { id: kind === "id" ? ID(51) : ID(50), revision: kind === "revision" ? 3 : 2 }
    mocks.read.mockResolvedValue(saved)
    await expect(prepareResearchApplication(input)).rejects.toThrow(/provenance/)
    expect(mocks.load).not.toHaveBeenCalled()
  })
})
