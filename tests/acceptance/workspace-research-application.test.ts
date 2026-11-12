import { researchVisiblePlacement } from "@/features/workspace-particles/lib/research-visible-placement"
import { researchPlanOperations } from "@/features/workspace-particles/lib/research-plan"
import { particlePlacementBounds } from "@/features/workspace-particles/lib/particle-creation-placement"
import { overlaps } from "@/lib/workspace-canvas/canvas-chat-geometry"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ID, WORKSPACE, NOW, graph, particle } from "./fixtures/particle-fixtures"
import type { KnowledgeRecord, ResearchResult } from "@/features/workspace-ai/research-types"
import type { ParticleCommit, ParticleResult } from "@/features/workspace-particles/types"
import { particlePlanningPermissionError } from "@/features/workspace-particles/lib/particle-plan-authority"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { prepareAuthorizedParticleMutation } from "@/features/workspace-particles/lib/authorized-mutation"
import type { ResearchTransport } from "@/features/workspace-particles/hooks/use-particle-research"
import { useParticleSession } from "@/features/workspace-particles/hooks/use-particle-session"
const mocks = vi.hoisted(() => ({ context: vi.fn(), read: vi.fn(), load: vi.fn(), write: vi.fn() }))
vi.mock("@/features/workspace-ai/server/research-context", () => ({ loadResearchContext: mocks.context }))
vi.mock("@/features/ai-credits", () => ({ readAiRun: mocks.read }))
vi.mock("@/features/workspace-ai/server/knowledge-records", () => ({ knowledgeLoader: () => mocks.load }))
vi.mock("@/features/workspace-ai/server", async () => ({ prepareResearchApplication: (await import("@/features/workspace-ai/server/research-application")).prepareResearchApplication }))
vi.mock("@/app/(dashboard)/my-organization/_lib/workspace-particle-write", () => ({ writeWorkspaceParticleBatch: mocks.write }))
import { applyWorkspaceResearchAction } from "@/app/(dashboard)/my-organization/_lib/workspace-research-actions"
import { knowledgeFingerprint, researchContextFingerprint } from "@/features/workspace-ai/server/research-dependencies"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import { createResearchDraft, applyResearchDraft } from "@/features/workspace-ai/lib/research-draft"
import { prepareResearchApplication } from "@/features/workspace-ai/server/research-application"
import { particleRegistry } from "@/features/workspace-particles/lib/particle-registry"
const target = { organizationId: WORKSPACE, objectiveId: ID(1), revision: 0 }
const input = { organizationId: WORKSPACE, objectiveId: ID(1), runId: ID(8) }
const before = graph([particle(1, "objective")])
function result(): ResearchResult {
  return { runId: ID(8), target, title: "Saved research", summary: "Evidence-backed proposal", questions: [], decisions: [], sources: [],
    items: [{ key: "first", kind: "note", title: "Confirm availability", description: "Ask the venue", referenceId: null, evidenceIds: [], dependsOn: [] }] }
}
const sourceRecord = (id: string, revision: string): KnowledgeRecord => ({id,revision,kind:id.startsWith("particle:")?"particle":"person",title:"Evidence",content:"Private record",href:"/workspace",contentAvailable:true})
function run(value = result(), current = before) {
  const context={graph:current,objective:current.particles[0],target:value.target} as ResearchContext
  const dependencies={version:1 as const,contextFingerprint:researchContextFingerprint(context),records:value.sources.map(source=>{
    const record=sourceRecord(source.id,source.revision!)
    return {id:record.id,kind:record.kind,fingerprint:knowledgeFingerprint(record)}
  })}
  return { id: ID(8), status: "succeeded", target: { ...value.target, kind: "particle_research", userId: ID(90), canvasId: null }, proposal: JSON.stringify({...value,dependencies}), charged_credits: 2, cancel_requested_at: null }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.context.mockResolvedValue({ target, user: { id: ID(90) }, graph: before, objective: before.particles[0], canvasId: null })
  mocks.read.mockResolvedValue(run())
  mocks.load.mockResolvedValue([])
})
describe("server-owned research application", () => {
  it("refuses an old saved proposal when a currently registered output command changes", async () => {
    const capability = particleRegistry.activity.capabilities.workspace_note
    const original = capability.action
    try {
      Reflect.set(capability, "action", "disabled")
      await expect(prepareResearchApplication(input)).rejects.toThrow(/Planning outputs are unavailable/)
      expect(mocks.write).not.toHaveBeenCalled()
    } finally { Reflect.set(capability, "action", original) }
  })
  it("builds a pending proposal only from the actor's saved result", async () => {
    const prepared = await prepareResearchApplication(input)
    expect(mocks.read).toHaveBeenCalledWith(ID(8), WORKSPACE, ID(90))
    expect(prepared.batch).toMatchObject({ workspaceId: WORKSPACE, baseRevision: 0, requireExactRevision: true })
    const operation = prepared.batch!.operations.at(-1)!
    expect(operation.kind === "put_particle" && operation.particle.type === "objective" && operation.particle.data.planning?.proposals[0]).toMatchObject({ title: "Saved research", authorId: ID(90), status: "pending", researchRunId: ID(8) })
  })
  it("applies bounded human edits without changing the saved AI result or approval", async () => {
    const draft = createResearchDraft(result())
    draft.title = "My plan"; draft.summary = "My summary"; draft.items[0].title = "Call the venue"; draft.items[0].description = "Ask about Friday"
    const original = run()
    mocks.read.mockResolvedValue(original)
    const prepared = await prepareResearchApplication({ ...input, draft })
    expect(original.proposal).toBe(run().proposal)
    const operations = prepared.batch!.operations
    expect(operations).toContainEqual(expect.objectContaining({ kind: "put_particle", particle: expect.objectContaining({ title: "Call the venue", description: "Ask about Friday" }) }))
    const operation = operations.at(-1)!
    expect(operation.kind === "put_particle" && operation.particle.type === "objective" && operation.particle.data.planning?.proposals[0]).toMatchObject({ title: "My plan", summary: "My summary", status: "pending", researchRunId: ID(8), authorId: ID(90) })
    const saved = await applyParticleBatch(before, prepared.batch!, NOW)
    if (!saved.ok) throw Error(saved.error)
    mocks.context.mockResolvedValue({ target, user: { id: ID(90) }, graph: saved.value.graph, objective: saved.value.graph.particles.find(p => p.id === ID(1)), canvasId: null })
    expect((await prepareResearchApplication({ ...input, draft })).batch).toBeNull()
  })
  it.each(["sources", "dependencies", "target", "dependsOn", "kind", "blank", "oversized", "duplicate", "missing", "unknown"])("rejects %s edits without a canonical write", async invalid => {
    const draft = createResearchDraft(result())
    if (["sources", "dependencies", "target"].includes(invalid)) Object.assign(draft, { [invalid]: {} })
    if (["dependsOn", "kind"].includes(invalid)) Object.assign(draft.items[0], { [invalid]: "forged" })
    if (invalid === "blank") draft.title = "  "
    if (invalid === "oversized") draft.items[0].description = "x".repeat(1801)
    if (invalid === "duplicate") draft.items.push(draft.items[0])
    if (invalid === "missing") draft.items = []
    if (invalid === "unknown") draft.items[0].key = "injected"
    await expect(prepareResearchApplication({ ...input, draft })).rejects.toThrow()
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it("preserves reference items, links and evidence, and refuses edits to existing content", () => {
    const value = result()
    value.items.push({ ...value.items[0], key: "existing", kind: "reference", referenceId: `particle:${ID(2)}` })
    value.items[0].evidenceIds = ["person:context"]
    const draft = createResearchDraft(value)
    draft.items[0].title = "Human wording"
    const edited = applyResearchDraft(value, draft)
    expect(edited.items[1]).toEqual(value.items[1])
    expect(edited.items[0].evidenceIds).toEqual(value.items[0].evidenceIds)
    expect(edited.sources).toBe(value.sources)
    draft.items.push({ key: "existing", title: "Overwrite", description: "", dependsOn: [] })
    expect(() => applyResearchDraft(value, draft)).toThrow(/Preview items changed/)
  })
  it("still rejects revoked evidence when all visible copy was edited", async () => {
    const value = result()
    value.sources = [{ id: `person:${ID(20)}`, title: "Venue", href: "/workspace", revision: "v1", kind: "workspace", checkedAt: NOW }]
    value.items[0].evidenceIds = [value.sources[0].id]
    mocks.read.mockResolvedValue(run(value))
    const draft = createResearchDraft(value); draft.title = "My plan"
    await expect(prepareResearchApplication({ ...input, draft })).rejects.toThrow(/source changed/)
  })
  it("saves edited prerequisites as pending links without changing the immutable run", async () => {
    const value = result()
    value.items.push({ ...value.items[0], key: "next", title: "Invite volunteers", dependsOn: ["first"] })
    const original = run(value); mocks.read.mockResolvedValue(original)
    const draft = createResearchDraft(value)
    draft.items[1].dependsOn = []; draft.items[0].dependsOn = ["next"]
    const prepared = await prepareResearchApplication({ ...input, draft })
    const saved = await applyParticleBatch(before, prepared.batch!, NOW)
    if (!saved.ok) throw Error(saved.error)
    const particles = saved.value.graph.particles
    const objective = particles.find(p => p.type === "objective")!
    if (objective.type !== "objective") throw Error("Missing objective")
    expect(objective.data.planning?.proposals[0]).toMatchObject({ status: "pending", links: [
      { source: particles.find(p => p.title === "Invite volunteers")!.id, target: particles.find(p => p.title === "Confirm availability")!.id },
    ] })
    expect(JSON.parse(original.proposal).items).toEqual(value.items)
  })
  it.each(["self", "unknown", "duplicate", "cycle", "branch-cycle", "branch-overlap", "too-many"])("rejects %s prerequisites before writing", async invalid => {
    const value = result()
    value.items.push({ ...value.items[0], key: "next", dependsOn: ["first"] })
    if (invalid.startsWith("branch")) {
      value.items[0].kind = "decision"
      value.items[1].dependsOn = []
      value.decisions = [{ itemKey: "first", outcomes: [{ key: "yes", label: "Yes", next: ["next"] }, { key: "no", label: "No", next: [] }] }]
    }
    mocks.read.mockResolvedValue(run(value))
    const draft = createResearchDraft(value)
    if (invalid === "self") draft.items[0].dependsOn = ["first"]
    if (invalid === "unknown") draft.items[0].dependsOn = ["unavailable"]
    if (invalid === "duplicate") draft.items[1].dependsOn = ["first", "first"]
    if (invalid === "cycle" || invalid === "branch-cycle") draft.items[0].dependsOn = ["next"]
    if (invalid === "branch-overlap") draft.items[1].dependsOn = ["first"]
    if (invalid === "too-many") draft.items[0].dependsOn = Array.from({ length: 9 }, (_, index) => `item_${index}`)
    await expect(prepareResearchApplication({ ...input, draft })).rejects.toThrow()
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it("saves manual additions and explicit removals through pending review, with replay protection", async () => {
    const value = result(), original = run(value)
    mocks.read.mockResolvedValue(original)
    const draft = createResearchDraft(value)
    draft.removedKeys = ["first"]
    draft.addedItems = [
      { key: "manual_one", title: "Prepare supplies", description: "My own work", dependsOn: [] },
      { key: "manual_two", title: "Deliver supplies", description: "", dependsOn: ["manual_one"] },
    ]
    const prepared = await prepareResearchApplication({ ...input, draft })
    const saved = await applyParticleBatch(before, prepared.batch!, NOW)
    if (!saved.ok) throw Error(saved.error)
    const particles = saved.value.graph.particles
    expect(particles.some(item => item.title === "Confirm availability")).toBe(false)
    const objective = particles.find(p => p.type === "objective")!
    if (objective.type !== "objective") throw Error("Missing objective")
    expect(objective.data.planning?.plans).toEqual([])
    expect(objective.data.planning?.proposals[0]).toMatchObject({ status: "pending", researchRunId: ID(8), links: [{
      source: particles.find(p => p.title === "Prepare supplies")!.id, target: particles.find(p => p.title === "Deliver supplies")!.id,
    }] })
    expect(applyResearchDraft(value, draft).items[0]).toMatchObject({ kind: "note", referenceId: null, evidenceIds: [] })
    expect(JSON.parse(original.proposal).items).toEqual(value.items)
    mocks.context.mockResolvedValue({ target, user: { id: ID(90) }, graph: saved.value.graph, objective, canvasId: null })
    expect((await prepareResearchApplication({ ...input, draft })).batch).toBeNull()
  })
  it.each(["collision", "duplicate", "source", "reference", "kind", "canonical-id", "cycle", "oversized", "empty", "unknown-removal", "duplicate-removal", "dangling"])("rejects %s structural edits before writing", async invalid => {
    const value = result(), draft = createResearchDraft(value)
    draft.addedItems = [{ key: "manual_one", title: "My task", description: "", dependsOn: [] }]
    if (invalid === "collision") draft.addedItems[0].key = "first"
    if (invalid === "duplicate") draft.addedItems.push(draft.addedItems[0])
    if (invalid === "source") Object.assign(draft.addedItems[0], { evidenceIds: ["person:private"] })
    if (invalid === "reference") Object.assign(draft.addedItems[0], { referenceId: `particle:${ID(2)}` })
    if (invalid === "kind") Object.assign(draft.addedItems[0], { kind: "decision" })
    if (invalid === "canonical-id") Object.assign(draft.addedItems[0], { id: ID(2) })
    if (invalid === "cycle") { draft.addedItems[0].dependsOn = ["first"]; draft.items[0].dependsOn = ["manual_one"] }
    if (invalid === "oversized") draft.addedItems = Array.from({ length: 12 }, (_, index) => ({ key: `manual_${index}`, title: "Task", description: "", dependsOn: [] }))
    if (invalid === "empty") { draft.addedItems = []; draft.removedKeys = ["first"] }
    if (invalid === "unknown-removal") draft.removedKeys = ["unknown"]
    if (invalid === "duplicate-removal") draft.removedKeys = ["first", "first"]
    if (invalid === "dangling") { draft.removedKeys = ["first"]; draft.addedItems[0].dependsOn = ["first"] }
    await expect(prepareResearchApplication({ ...input, draft })).rejects.toThrow()
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it.each(["reference", "reference-dependency", "decision", "branch-target"])("preserves %s during removal", invalid => {
    const value = result()
    if (invalid.startsWith("reference")) value.items.push({ ...value.items[0], key: "existing", kind: "reference", referenceId: `particle:${ID(2)}`, dependsOn: invalid === "reference-dependency" ? ["first"] : [] })
    if (invalid === "decision") value.items[0].kind = "decision"
    if (invalid === "branch-target") {
      value.items.push({ ...value.items[0], key: "choice", kind: "decision" })
      value.decisions = [{ itemKey: "choice", outcomes: [{ key: "yes", label: "Yes", next: ["first"] }, { key: "no", label: "No", next: [] }] }]
    }
    const draft = createResearchDraft(value)
    draft.removedKeys = [invalid === "reference" ? "existing" : "first"]
    expect(() => applyResearchDraft(value, draft)).toThrow()
  })
  it("cannot bypass source revocation by replacing every generated item", async () => {
    const value = result()
    value.sources = [{ id: `person:${ID(20)}`, title: "Venue", href: "/workspace", revision: "v1", kind: "workspace", checkedAt: NOW }]
    value.items[0].evidenceIds = [value.sources[0].id]
    mocks.read.mockResolvedValue(run(value))
    const draft = createResearchDraft(value)
    draft.removedKeys = ["first"]
    draft.addedItems = [{ key: "manual_one", title: "My task", description: "", dependsOn: [] }]
    await expect(prepareResearchApplication({ ...input, draft })).rejects.toThrow(/source changed/)
  })
  it("keeps version-two prerequisite edits compatible and forbids structural extensions", () => {
    const value = result(), current = createResearchDraft(value)
    const draft = { version: 2 as const, title: current.title, summary: current.summary, items: current.items }
    expect(applyResearchDraft(value, draft)).toEqual(value)
    Object.assign(draft, { removedKeys: ["first"] })
    expect(() => applyResearchDraft(value, draft)).toThrow()
  })
  it("keeps legacy version-one edits copy-only", () => {
    const value = result()
    const draft = { version: 1 as const, title: "Legacy title", summary: "", items: [{ key: "first", title: "Legacy item", description: "" }] }
    expect(applyResearchDraft(value, draft).items[0].dependsOn).toEqual([])
    Object.assign(draft.items[0], { dependsOn: [] })
    expect(() => applyResearchDraft(value, draft)).toThrow()
  })
  it("saves edited decision labels and destinations without choosing an outcome", async () => {
    const value = result()
    value.items.push({ ...value.items[0], key: "choice", kind: "decision", title: "Select venue" })
    value.decisions = [{ itemKey: "choice", outcomes: [{ key: "yes", label: "Yes", next: ["first"] }, { key: "no", label: "No", next: [] }] }]
    const original = run(value); mocks.read.mockResolvedValue(original)
    const draft = createResearchDraft(value)
    draft.addedItems.push({ key: "manual_other", title: "Find another venue", description: "", dependsOn: [] })
    draft.decisions[0].outcomes[0] = { key: "yes", label: "Available", next: [] }
    draft.decisions[0].outcomes[1] = { key: "no", label: "Unavailable", next: ["manual_other"] }
    draft.removedKeys = ["first"]
    const prepared = await prepareResearchApplication({ ...input, draft })
    const saved = await applyParticleBatch(before, prepared.batch!, NOW)
    if (!saved.ok) throw Error(saved.error)
    const particles = saved.value.graph.particles
    const decision = particles.find(p => p.type === "decision")!
    expect(decision.data).toMatchObject({ selectedOutcome: null, outcomes: [{ id: "yes", label: "Available" }, { id: "no", label: "Unavailable" }] })
    const objective = particles.find(p => p.type === "objective")!
    if (objective.type !== "objective") throw Error("Missing objective")
    expect(objective.data.planning?.proposals[0]).toMatchObject({ status: "pending", links: [{ source: decision.id, target: particles.find(p => p.title === "Find another venue")!.id, outcome: "no" }] })
    expect(JSON.parse(original.proposal).decisions).toEqual(value.decisions)
  })
  it.each(["missing-decision", "duplicate-decision", "unknown-decision", "missing-outcome", "duplicate-outcome", "unknown-outcome", "duplicate-label", "blank-label", "long-label", "self", "unknown-target", "duplicate-target", "cycle", "overlap", "selected", "reference"])("rejects %s branch edits before writing", async invalid => {
    const value = result()
    value.items.push({ ...value.items[0], key: "choice", kind: "decision" })
    value.decisions = [{ itemKey: "choice", outcomes: [{ key: "yes", label: "Yes", next: ["first"] }, { key: "no", label: "No", next: [] }] }]
    if (invalid === "reference") { value.items[1].kind = "reference"; value.items[1].referenceId = `particle:${ID(2)}` }
    mocks.read.mockResolvedValue(run(value))
    const draft = createResearchDraft(value)
    if (invalid === "reference") draft.decisions = structuredClone(value.decisions)
    const decision = draft.decisions[0]
    if (invalid === "missing-decision") draft.decisions = []
    if (invalid === "duplicate-decision") draft.decisions.push(structuredClone(decision))
    if (invalid === "unknown-decision") decision.itemKey = "first"
    if (invalid === "missing-outcome") decision.outcomes.pop()
    if (invalid === "duplicate-outcome") decision.outcomes[1].key = "yes"
    if (invalid === "unknown-outcome") decision.outcomes[1].key = "other"
    if (invalid === "duplicate-label") decision.outcomes[1].label = " YES "
    if (invalid === "blank-label") decision.outcomes[0].label = " "
    if (invalid === "long-label") decision.outcomes[0].label = "x".repeat(241)
    if (invalid === "self") decision.outcomes[0].next = ["choice"]
    if (invalid === "unknown-target") decision.outcomes[0].next = ["other"]
    if (invalid === "duplicate-target") decision.outcomes[0].next = ["first", "first"]
    if (invalid === "cycle") draft.items[1].dependsOn = ["first"]
    if (invalid === "overlap") draft.items[0].dependsOn = ["choice"]
    if (invalid === "selected") Object.assign(decision, { selectedOutcome: "yes" })
    await expect(prepareResearchApplication({ ...input, draft })).rejects.toThrow()
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it("keeps version-three drafts compatible and reference branches unchanged", () => {
    const value = result()
    value.items.push({ ...value.items[0], key: "existing", kind: "reference", referenceId: `particle:${ID(2)}` })
    value.decisions = [{ itemKey: "existing", outcomes: [{ key: "yes", label: "Yes", next: ["first"] }, { key: "no", label: "No", next: [] }] }]
    const draft = createResearchDraft(value)
    expect(draft.decisions).toEqual([])
    expect(applyResearchDraft(value, draft).decisions).toEqual(value.decisions)
    const legacy = { version: 3 as const, title: draft.title, summary: draft.summary, items: draft.items, addedItems: draft.addedItems, removedKeys: draft.removedKeys }
    expect(applyResearchDraft(value, legacy)).toEqual(value)
    Object.assign(legacy, { decisions: value.decisions })
    expect(() => applyResearchDraft(value, legacy)).toThrow()
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
    mocks.context.mockResolvedValue({ target, user: { id: ID(90) }, graph: changed, objective: changed.particles[0], canvasId: null })
    await expect(prepareResearchApplication(input)).rejects.toThrow(/Objective changed/)
  })
  it("rechecks private evidence access and revision", async () => {
    const value = result()
    value.sources = [{ id: `person:${ID(20)}`, title: "Venue contact", href: "/workspace", revision: "v1", kind: "workspace", checkedAt: NOW }]
    value.items[0].evidenceIds = [value.sources[0].id]
    mocks.read.mockResolvedValue(run(value))
    await expect(prepareResearchApplication(input)).rejects.toThrow(/source changed/)
    mocks.load.mockResolvedValue([sourceRecord(value.sources[0].id,"v2")])
    await expect(prepareResearchApplication(input)).rejects.toThrow(/source changed/)
    mocks.load.mockResolvedValue([sourceRecord(value.sources[0].id,"v1")])
    expect((await prepareResearchApplication(input)).batch).not.toBeNull()
    expect(mocks.load).toHaveBeenLastCalledWith("person", "", value.sources[0].id)
  })
  it("blocks an uncited revoked input before preparing any canonical write",async()=>{
    const saved=run(),proposal=JSON.parse(saved.proposal)
    const record=sourceRecord(`person:${ID(20)}`,"v1")
    proposal.dependencies.records=[{id:record.id,kind:record.kind,fingerprint:knowledgeFingerprint(record)}]
    saved.proposal=JSON.stringify(proposal);mocks.read.mockResolvedValue(saved)
    await expect(prepareResearchApplication(input)).rejects.toThrow(/source changed/)
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it("requires new research for historical results without a dependency manifest",async()=>{
    const saved=run();saved.proposal=JSON.stringify(result());mocks.read.mockResolvedValue(saved)
    await expect(prepareResearchApplication(input)).rejects.toThrow(/predates complete access tracking/)
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it("replays from durable proposal history after graph receipts expire", async () => {
    const prepared = await prepareResearchApplication(input)
    const saved = await applyParticleBatch(before, prepared.batch!, NOW)
    if (!saved.ok) throw Error(saved.error)
    const current = { ...saved.value.graph, receipts: [] }
    mocks.context.mockResolvedValue({ target, user: { id: ID(90) }, graph: current, objective: current.particles.find(item => item.id === ID(1)), canvasId: null })
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
    const transport = vi.fn<ResearchTransport>(() => new Promise(done => { resolve = done }))
    let session!: ReturnType<typeof useParticleSession>
    function Harness() {
      session = useParticleSession({ workspaceId: WORKSPACE, stored: before, canEdit: true, transport: vi.fn(), researchTransport: transport, load: async () => ({ ok: true, value: before }) })
      return null
    }
    renderToStaticMarkup(createElement(Harness))
    const draft = createResearchDraft(result()); draft.title = "My retry title"
    const first = session.applyResearch(ID(8), ID(1), draft)
    expect(await session.applyResearch(ID(8), ID(1))).toBeNull()
    expect(await session.commit([])).toBe(false)
    expect(session.getCurrentGraph()).toEqual(before)
    resolve({ ok: false, code: "unavailable", error: "Interrupted" })
    expect(await first).toBeNull()
    const retry = session.applyResearch(ID(8), ID(1), draft)
    const saved = { graph: { ...before, revision: 1 }, inverse: [], replayed: true }
    resolve({ ok: true, value: saved })
    expect(await retry).toEqual(saved)
    expect(session.getCurrentGraph()?.revision).toBe(1)
    expect(transport.mock.calls.map(call => call[0])).toEqual([{ ...input, draft }, { ...input, draft }])
  })
})

describe("server-owned revision application", () => {
  function revision() {
    const objective = particle(1, "objective"), member = particle(2)
    if (objective.type !== "objective") throw Error()
    objective.data.planning = { plans: [{ id: ID(50), revision: 2, title: "Accepted", particleIds: [member.id] }], proposals: [] }
    const current = { ...graph([objective, member]), revision: 2 }
    const value: ResearchResult = { ...result(), target: { ...target, plan: { id: ID(50), revision: 2 } }, items: [], removeReferences: [`particle:${member.id}`], sources: [{ id: `particle:${member.id}`, title: member.title, href: "/workspace", revision: "0", checkedAt: NOW, kind: "workspace" }] }
    mocks.context.mockResolvedValue({ target, user: { id: ID(90) }, graph: current, objective, canvasId: null })
    mocks.read.mockResolvedValue(run(value,current))
    mocks.load.mockResolvedValue([sourceRecord(`particle:${member.id}`,"0")])
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
    const { value, current } = revision(), saved = run(value,current)
    if (kind === "missing") delete saved.target.plan
    else saved.target.plan = { id: kind === "id" ? ID(51) : ID(50), revision: kind === "revision" ? 3 : 2 }
    mocks.read.mockResolvedValue(saved)
    await expect(prepareResearchApplication(input)).rejects.toMatchObject({code:"invalid_result"})
    expect(mocks.load).not.toHaveBeenCalled()
  })
})


describe("atomic new objective application", () => {
  const newTarget = { mode: "new_objective" as const, organizationId: WORKSPACE, canvasId: null, revision: 0 }
  const newInput = { runId: ID(8), organizationId: WORKSPACE, target: newTarget }
  function setup(current = graph([])) {
    const context = { user: { id: ID(90) }, graph: current, canvasId: null, target: newTarget } as ResearchContext
    const value = { ...result(), target: newTarget, dependencies: { version: 1, contextFingerprint: researchContextFingerprint(context), records: [] } }
    mocks.context.mockResolvedValue(context)
    mocks.read.mockResolvedValue({ id: ID(8), status: "succeeded", target: { ...newTarget, kind: "particle_research", userId: ID(90) }, proposal: JSON.stringify(value), charged_credits: 2, cancel_requested_at: null })
    return context
  }
  it("commits the new objective and proposed members together under existing member permissions", async () => {
    const context = setup()
    const before = structuredClone(context.graph)
    const prepared = await prepareResearchApplication(newInput)
    expect(context.graph).toEqual(before)
    expect(prepared.batch?.requireExactRevision).toBe(true)
    expect(prepared.batch?.operations).toHaveLength(2)
    const mutation = await prepareAuthorizedParticleMutation({ input: prepared.batch, workspaceId: WORKSPACE, canEdit: true, now: NOW,
      planningActor: { userId: ID(90), isOrganizationOwner: false }, authorizedResearch: { runId: ID(8), objectiveId: prepared.objectiveId } })
    if (!mutation.ok) throw Error(mutation.error)
    const saved = mutation.value(context.graph)
    const objective = saved.graph.particles.find(p => p.id === prepared.objectiveId)
    expect(objective).toMatchObject({ type: "objective", title: "Saved research", status: "backlog", data: { planning: { plans: [], proposals: [{ status: "pending", authorId: ID(90), researchRunId: ID(8) }] } } })
    expect(saved.graph.particles).toHaveLength(2)
    mocks.context.mockResolvedValue({ ...context, graph: { ...saved.graph, receipts: [] } })
    const retry = await prepareResearchApplication(newInput)
    expect(retry.batch).toBeNull(); expect(retry.objectiveId).toBe(prepared.objectiveId)
  })
  it("places a complete pending plan at the drop point and replays without moving it", async () => {
    const context = setup()
    const record = await mocks.read(), value = JSON.parse(record.proposal)
    value.items.push({ ...value.items[0], key: "second", title: "Invite volunteers", dependsOn: ["first"] })
    mocks.read.mockResolvedValue({ ...record, proposal: JSON.stringify(value) })
    const prepared = await prepareResearchApplication({ ...newInput, placement: { x: -600, y: 450 } })
    const mutation = await prepareAuthorizedParticleMutation({ input: prepared.batch, workspaceId: WORKSPACE, canEdit: true, now: NOW,
      planningActor: { userId: ID(90), isOrganizationOwner: false }, authorizedResearch: { runId: ID(8), objectiveId: prepared.objectiveId } })
    if (!mutation.ok) throw Error(mutation.error)
    const saved = mutation.value(context.graph)
    const objective = saved.graph.particles.find(p => p.id === prepared.objectiveId)
    expect(objective).toMatchObject({ position: { x: -600, y: 450 }, positionMode: "manual" })
    if (objective?.type !== "objective") throw Error("Missing objective")
    expect(objective.data.planning?.proposals[0]).toMatchObject({ status: "pending", links: [{ source: expect.any(String), target: expect.any(String) }] })
    expect(saved.graph.particles).toHaveLength(3)
    mocks.context.mockResolvedValue({ ...context, graph: { ...saved.graph, receipts: [] } })
    const retry = await prepareResearchApplication({ ...newInput, placement: { x: 1000, y: 1000 } })
    expect(retry.batch).toBeNull()
    expect(retry.context.graph).toEqual({ ...saved.graph, receipts: [] })
  })
  it("moves the dropped plan around existing locked cards, never moving those cards", async () => {
    const existing = { ...particle(11, "activity"), locked: true, position: { x: 100, y: 100 } }
    const context = setup(graph([existing])), before = structuredClone(context.graph)
    const prepared = await prepareResearchApplication({ ...newInput, placement: { x: 100, y: 100 } })
    const writes = prepared.batch!.operations.filter(op => op.kind === "put_particle")
    expect(writes.some(op => op.particle.id === existing.id)).toBe(false)
    expect(writes.find(op => op.particle.type === "objective")!.particle.position.y).toBeGreaterThan(100)
    expect(context.graph).toEqual(before)
  })
  it("rejects invalid drop coordinates and placement for an existing objective", async () => {
    setup()
    for (const placement of [{ x: Infinity, y: 0 }, { x: 0, y: 1_000_001 }, { x: 0, y: 0, graph: {} }])
      await expect(prepareResearchApplication({ ...newInput, placement })).rejects.toThrow()
    await expect(prepareResearchApplication({ ...input, placement: { x: 0, y: 0 } })).rejects.toThrow()
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it("rejects board changes and client content without a partial write", async () => {
    setup({ ...graph(), revision: 1 })
    await expect(prepareResearchApplication(newInput)).rejects.toThrow(/Workspace changed/)
    expect(mocks.write).not.toHaveBeenCalled()
    await expect(prepareResearchApplication({ ...newInput, result: result() })).rejects.toThrow()
  })
  it("does not let manual writes forge a research origin", async () => {
    const context = setup(), prepared = await prepareResearchApplication(newInput)
    const mutation = await prepareAuthorizedParticleMutation({ input: prepared.batch, workspaceId: WORKSPACE, canEdit: true, now: NOW,
      planningActor: { userId: ID(90), isOrganizationOwner: true } })
    if (!mutation.ok) throw Error(mutation.error)
    expect(() => mutation.value(context.graph)).toThrow(/saved proposal/)
  })
  it("checks private dependencies before saving a new objective", async () => {
    setup()
    const run = await mocks.read(), value = JSON.parse(run.proposal)
    const record = sourceRecord(`person:${ID(20)}`, "v1")
    value.dependencies.records = [{ id: record.id, kind: record.kind, fingerprint: knowledgeFingerprint(record) }]
    mocks.read.mockResolvedValue({ ...run, proposal: JSON.stringify(value) })
    await expect(prepareResearchApplication(newInput)).rejects.toThrow(/source changed/)
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it("routes only the exact canvas and uses the server-created objective identity", async () => {
    setup()
    mocks.write.mockResolvedValue({ ok: true, value: { graph: graph(), inverse: [], replayed: false } })
    expect((await applyWorkspaceResearchAction(newInput)).ok).toBe(true)
    expect(mocks.write.mock.calls[0][2]).toMatchObject({ runId: ID(8), objectiveId: expect.any(String) })
    mocks.write.mockClear()
    expect(await applyWorkspaceResearchAction(newInput, ID(50))).toMatchObject({ ok: false, code: "scope" })
    expect(mocks.write).not.toHaveBeenCalled()
  })
})


describe("generated plan placement beside the chat", () => {
  it.each([0.5, 1, 2])("keeps the whole saved branch clear at zoom %s without moving existing particles", zoom => {
    const existing = particle(101); existing.position = { x: 900, y: 100 }
    const current = graph([existing]), snapshot = structuredClone(current)
    const chat = { x: 100, y: 100, width: 700 / zoom, height: 400 / zoom }
    const value: ResearchResult = { ...result(), target: { mode: "new_objective", organizationId: WORKSPACE, canvasId: null, revision: current.revision } }
    value.items.push({ ...value.items[0], key: "second", title: "Follow up", dependsOn: ["first"] })
    const measured = [{ ...existing.position, width: 900, height: 700 }]
    const position = researchVisiblePlacement(current, value, ID(90), chat, measured)
    let id = 200
    const operations = researchPlanOperations(current, value, ID(90), NOW, () => ID(id++), position)
    const added = operations.flatMap(op => op.kind === "put_particle" ? [op.particle] : [])
    expect(added).toHaveLength(3)
    for (const item of added) {
      const box = particlePlacementBounds(item, true)
      expect(overlaps(box, chat, 80)).toBe(false)
      expect(overlaps(box, measured[0], 80)).toBe(false)
    }
    expect(current).toEqual(snapshot)
    expect(added.find(item => item.type === "objective")?.position).toEqual(position)
  })
})

it.each(["answer", "clarify"] as const)("refuses to materialize a %s as a board artifact", async responseKind => {
  const reply = { ...result(), responseKind, items: [] }
  mocks.read.mockResolvedValue(run(reply))
  await expect(prepareResearchApplication(input)).rejects.toThrow("Chat replies cannot")
  const uuid = vi.fn()
  expect(() => researchPlanOperations(before, reply, ID(90), NOW, uuid)).toThrow("Chat replies cannot")
  expect(uuid).not.toHaveBeenCalled()
  expect(mocks.write).not.toHaveBeenCalled()
})
