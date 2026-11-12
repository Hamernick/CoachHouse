import { beforeEach, expect, it, vi } from "vitest"
import { batch, edge, graph, ID, NOW, particle, WORKSPACE } from "./fixtures/particle-fixtures"
import type { ParticleGraph } from "@/features/workspace-particles"
const mocks = vi.hoisted(() => ({ admin: vi.fn(), rpc: vi.fn(), actor: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/app/(dashboard)/my-organization/_lib/workspace-actions-support", () => ({ resolveActor: mocks.actor, canEditWorkspaceLayout: async () => true }))
vi.mock("@/lib/modules/notes-index", () => ({ listUserModuleNotesIndex: async () => [] }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
import { projectParticleGraphAudience, assertParticleAudienceMutation } from "@/features/workspace-particles/server/particle-audience"
import { readWorkspaceNoteDocuments } from "@/features/workspace-particles/server/note-documents"
import { readParticleGraph } from "@/features/workspace-particles"
import { loadWorkspaceParticleGraphAction } from "@/app/(dashboard)/my-organization/_lib/workspace-particle-actions"
import { writeWorkspaceParticleBatch } from "@/app/(dashboard)/my-organization/_lib/workspace-particle-write"
import { persistWorkspaceBoardState } from "@/app/(dashboard)/my-organization/_lib/workspace-board-state-write"
import { buildDefaultBoardState } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-layout"

import { readWorkspaceParticleCalendar } from "@/server/workspace-particle-calendar"
import { loadOpportunitySourceOptions } from "@/features/workspace-finance/server/opportunity-sources"
import { readWorkspaceAcceleratorBoardState } from "@/app/(dashboard)/my-organization/_lib/workspace-accelerator-state-read"

const actorId = ID(90), fileId = ID(91)
let allowed = false
let retained: Array<{ id: string; fileIds: string[]; complete: false }> = []
let failRead = false
let canvasVisible = true
let revokeOnCanvasRead = 0
beforeEach(() => {
  vi.clearAllMocks(); allowed = false; retained = []; failRead = false; canvasVisible = true; revokeOnCanvasRead = 0
  mocks.rpc.mockImplementation(async (name: string, args: { p_file_ids?: string[]; p_record_ids?: string[] }) => ({
    error: failRead ? { message: "private detail" } : null,
    data: name === "read_workspace_particle_ai_documents" ? [] : name === "read_workspace_particle_ai_files" ? retained.filter(item => args.p_record_ids?.includes(item.id)) : allowed ? args.p_file_ids : [],
  }))
  mocks.admin.mockReturnValue({ rpc: mocks.rpc })
})
function fixture(): ParticleGraph {
  const document = particle(1), note = particle(2), objective = particle(3, "objective"), other = particle(4)
  if (document.type !== "activity" || note.type !== "activity" || objective.type !== "objective") throw new Error("fixture")
  document.title = "Private document"
  document.data.widget = { kind: "document", fileId, name: "Secret.txt", size: 4, format: "txt" }
  note.title = "Private generated note"
  note.data.widget = { kind: "notes", source: { kind: "workspace", content: "Secret evidence" } }
  objective.data.planning = { plans: [{ id: ID(30), revision: 0, title: "Secret plan", particleIds: [document.id, note.id], researchRunId: ID(31), sources: [{ kind: "workspace", id: `file:${fileId}`, title: "Secret citation", href: "/workspace", revision: null, checkedAt: NOW }] }], proposals: [] }
  return { ...graph([document, note, objective, other], [edge(40, 3, 1), edge(41, 3, 4)]), rootId: objective.id }
}
function database(initial: ParticleGraph) {
  let stored = { ...buildDefaultBoardState(), particleGraph: initial }, revision = 0, writes = 0
  let onUpdate: (() => void) | undefined
  let canvasReads = 0
  const sourceTransport = mocks.rpc.getMockImplementation()!
  mocks.rpc.mockImplementation(async (name: string, args: unknown) => {
    if (name === "read_workspace_canvas_projection") {
      canvasReads++
      if (canvasReads === revokeOnCanvasRead) canvasVisible = false
      return Promise.resolve({ data: { state: canvasVisible ? structuredClone(stored) : { workspaceCatalog: { version: 1, defaultName: "Workspace", defaultDeleted: true, entries: [] } } }, error: null })
    }
    return sourceTransport(name, args)
  })
  const client = { rpc: (name: string, args: { p_expected_revision?: string; p_expected_state?: unknown; p_state?: typeof stored }) => {
    if (name !== "commit_workspace_board") return mocks.rpc(name, args)
    const hook = onUpdate; onUpdate = undefined; hook?.()
    if (args.p_expected_revision !== String(revision) || JSON.stringify(args.p_expected_state) !== JSON.stringify(stored)) return Promise.resolve({ data: false, error: null })
    stored = structuredClone(args.p_state!); revision++; writes++
    return Promise.resolve({ data: true, error: null })
  }, from: () => {
    let update: { state: typeof stored } | undefined, expected: string | undefined
    const chain = {
      select: () => chain,
      eq: (key: string, value: string) => { if (key === "updated_at") expected = value; return chain },
      update: (value: { state: typeof stored }) => { update = value; return chain },
      maybeSingle: async () => {
        if (!update) return { data: { state: structuredClone(stored), updated_at: String(revision) }, error: null }
        const hook = onUpdate; onUpdate = undefined; hook?.()
        if (expected !== String(revision)) return { data: null, error: null }
        stored = structuredClone(update.state); revision++; writes++
        return { data: { updated_at: String(revision) }, error: null }
      },
    }
    return chain
  } }
  mocks.admin.mockReturnValue(client)
  mocks.actor.mockResolvedValue({ supabase: client, user: { id: actorId }, activeOrg: { orgId: WORKSPACE, role: "owner" } })
  return { client, state: () => stored, writes: () => writes,
    beforeUpdate: (hook: () => void) => { onUpdate = hook },
    collaborate: () => {
      stored.particleGraph.particles[0].title = "New collaborator title"
      stored.particleGraph.particles[0].revision = 1; stored.particleGraph.revision = 1; revision++
    },
  }
}
it("withholds file metadata, generated notes, plans, roots, edges and receipts without changing canonical content", async () => {
  const canonical = fixture(), original = structuredClone(canonical)
  canonical.receipts = [{ id: ID(80), fingerprint: "a".repeat(64), revision: 1 }]; canonical.revision = 1
  const projected = await projectParticleGraphAudience(canonical, actorId)
  expect(projected).toMatchObject({ rootId: null, particles: [original.particles[3]], connections: [], receipts: [], revision: 1 })
  expect(JSON.stringify(projected)).not.toContain("Secret")
  expect(readParticleGraph(projected, WORKSPACE).ok).toBe(true)
  expect(canonical.particles).toEqual(original.particles)
  allowed = true
  expect(await projectParticleGraphAudience(canonical, actorId)).toBe(canonical)
  expect(mocks.rpc.mock.calls.filter(([name]) => name === "filter_document_file_audience").at(-1)).toEqual(["filter_document_file_audience", { p_actor_id: actorId, p_file_ids: [fileId] }])
})
it("checks retained origins after detachment, and fails closed on authority errors", async () => {
  const note = fixture().particles[1], canonical = graph([note, particle(4)])
  retained = [{ id: `particle:${note.id}`, fileIds: [fileId], complete: false }]
  expect((await projectParticleGraphAudience(canonical, actorId)).particles.map(item => item.id)).toEqual([ID(4)])
  failRead = true
  await expect(projectParticleGraphAudience(canonical, actorId)).rejects.toThrow("could not be verified")
})
it("withholds transitive checklist references without dangling IDs", async () => {
  const canonical = fixture(), first = particle(5, "workflow"), second = particle(6, "decision")
  if (first.type !== "workflow" || second.type !== "decision") throw new Error("fixture")
  first.data.steps = [{ id: ID(50), title: "Copied title", status: "backlog", order: 0, particleId: ID(1) }]
  second.data.criteria = [{ id: ID(51), title: "Copied title", status: "backlog", order: 0, particleId: ID(5) }]
  canonical.particles.push(second, first)
  const projected = await projectParticleGraphAudience(canonical, actorId)
  expect(projected.particles.map(item => item.id)).toEqual([ID(4)])
  expect(readParticleGraph(projected, WORKSPACE).ok).toBe(true)
})
it.each(["edit", "remove", "disconnect", "root"])("rejects hidden %s mutations while allowing unrelated changes", async kind => {
  const before = fixture(), next = structuredClone(before)
  if (kind === "edit") next.particles[0].title = "Changed"
  if (kind === "remove") next.particles.shift()
  if (kind === "disconnect") next.connections = []
  if (kind === "root") next.rootId = null
  await expect(assertParticleAudienceMutation(before, next, actorId)).rejects.toMatchObject({ code: "scope" })
  const unrelated = structuredClone(before); unrelated.particles[3].title = "Allowed edit"
  expect((await assertParticleAudienceMutation(before, unrelated, actorId)).particles[0].title).toBe("Allowed edit")
})
it("filters the actual load action and all-canvas note search/exact read", async () => {
  const db = database(fixture())
  expect(await loadWorkspaceParticleGraphAction()).toMatchObject({ ok: true, value: { particles: [expect.objectContaining({ id: ID(4) })] } })
  expect(await readWorkspaceNoteDocuments(db.client as never, WORKSPACE, actorId)).toEqual([])
  expect(await readWorkspaceNoteDocuments(db.client as never, WORKSPACE, actorId, ID(2))).toBeNull()
  allowed = true
  expect(await readWorkspaceNoteDocuments(db.client as never, WORKSPACE, actorId, ID(2))).toMatchObject({ particle: { title: "Private generated note" } })
  failRead = true
  expect(await loadWorkspaceParticleGraphAction()).toMatchObject({ ok: false, code: "unavailable" })
})
it("saves on the latest complete graph through CAS retries; filters response and replay without losing hidden collaborator edits", async () => {
  const initial = fixture(), db = database(initial)
  db.beforeUpdate(db.collaborate)
  const change = batch(70, [{ kind: "put_particle", particle: { ...initial.particles[3], title: "Visible edit" }, expectedRevision: 0 }])
  const result = await writeWorkspaceParticleBatch(change)
  expect(result).toMatchObject({ ok: true, value: { graph: { particles: [expect.objectContaining({ id: ID(4), title: "Visible edit" })] }, replayed: false } })
  expect(JSON.stringify(result)).not.toContain("Secret")
  expect(db.state().particleGraph.particles).toHaveLength(4)
  expect(db.state().particleGraph.particles[0].title).toBe("New collaborator title")
  expect(db.state().particleGraph.connections).toEqual(initial.connections)
  expect(db.writes()).toBe(1)
  const replay = await writeWorkspaceParticleBatch(change)
  expect(replay).toMatchObject({ ok: true, value: { replayed: true, inverse: [], graph: { particles: [expect.objectContaining({ id: ID(4) })] } } })
  expect(db.state().particleGraph.revision).toBe(2)
})
it("denies stale hidden edits before persistence and keeps undo from leaking a revoked deleted record", async () => {
  const note = fixture().particles[1], initial = graph([note, particle(4)])
  retained = [{ id: `particle:${note.id}`, fileIds: [fileId], complete: false }]
  const db = database(initial), change = batch(71, [{ kind: "remove_particle", id: note.id, expectedRevision: 0 }])
  expect(await writeWorkspaceParticleBatch(change)).toMatchObject({ ok: false, code: "scope" })
  expect(db.writes()).toBe(0)
  allowed = true; db.beforeUpdate(() => { allowed = false })
  const result = await writeWorkspaceParticleBatch(change)
  expect(result).toMatchObject({ ok: false, code: "scope" })
  expect(JSON.stringify(result)).not.toContain("Secret evidence")
  expect(db.writes()).toBe(1)
  expect(await writeWorkspaceParticleBatch(change)).toMatchObject({ ok: true, value: { replayed: true, inverse: [] } })
})
it("projects whole-board save responses only after writing canonical particles", async () => {
  const initial = fixture(), db = database(initial)
  const response = await persistWorkspaceBoardState({ supabase: db.client as never, orgId: WORKSPACE, userId: actorId,
    buildState: stored => ({ ...stored!, particleGraph: graph([]) }),
  })
  expect(response).toMatchObject({ ok: true, boardState: { particleGraph: { particles: [expect.objectContaining({ id: ID(4) })] } } })
  expect(db.state().particleGraph).toEqual(initial)
})
it.each([
  { data: null, error: { code: "42501", message: "Workspace editor access required." } },
  { data: null, error: { code: "40001", message: "Workspace permission or content is changing; retry." } },
  { data: null, error: null },
])("withholds whole-board responses when the atomic commit is denied or unconfirmed", async outcome => {
  const initial = fixture(), db = database(initial)
  const transport = db.client.rpc
  vi.spyOn(db.client, "rpc").mockImplementation((name, args) => name === "commit_workspace_board" ? Promise.resolve(outcome) : transport(name, args))
  const response = await persistWorkspaceBoardState({ supabase: db.client as never, orgId: WORKSPACE, userId: actorId,
    buildState: stored => stored!,
  })
  expect(response).toHaveProperty("error")
  expect(JSON.stringify(response)).not.toContain("Secret")
  expect(db.writes()).toBe(0)
  expect(db.state().particleGraph).toEqual(initial)
})
it("retries a layout save without discarding a hidden collaborator edit", async () => {
  const db = database(fixture())
  db.beforeUpdate(db.collaborate)
  const result = await persistWorkspaceBoardState({ supabase: db.client as never, orgId: WORKSPACE, userId: actorId,
    buildState: stored => ({ ...stored!, preset: "calendar-focused", particleGraph: graph([]) }),
  })
  expect(result).toMatchObject({ ok: true, boardState: { preset: "calendar-focused" } })
  expect(db.state().particleGraph.particles[0].title).toBe("New collaborator title")
  expect(db.state().particleGraph.particles).toHaveLength(4)
  expect(JSON.stringify(result)).not.toContain("New collaborator title")
  expect(db.writes()).toBe(1)
})
it("rechecks revocation on a newer CAS snapshot before retrying a save", async () => {
  const initial = fixture(), db = database(initial)
  allowed = true
  db.beforeUpdate(() => { db.collaborate(); allowed = false })
  const change = batch(72, [{ kind: "put_particle", particle: { ...initial.particles[1], title: "Stale authorized edit" }, expectedRevision: 0 }])
  expect(await writeWorkspaceParticleBatch(change)).toMatchObject({ ok: false, code: "scope" })
  expect(db.writes()).toBe(0)
  expect(db.state().particleGraph.particles[0].title).toBe("New collaborator title")
  expect(db.state().particleGraph.particles[1]).toEqual(initial.particles[1])
})

function restrictedClient(error = { code: "42501", message: "Board source access required." }) {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error }) }
  return { from: () => query }
}
it("keeps mixed-audience graph and note readers usable after raw database denial", async () => {
  const db = database(fixture()), client = restrictedClient()
  mocks.actor.mockResolvedValue({ supabase: client, user: { id: actorId }, activeOrg: { orgId: WORKSPACE, role: "staff" } })
  mocks.rpc.mockResolvedValueOnce({ data: { state: db.state() }, error: null })
  const loaded = await loadWorkspaceParticleGraphAction()
  expect(loaded).toMatchObject({ ok: true, value: { particles: [expect.objectContaining({ id: ID(4) })] } })
  expect(JSON.stringify(loaded)).not.toContain("Secret")
  expect(mocks.rpc).toHaveBeenCalledWith("read_workspace_canvas_projection", { p_org_id: WORKSPACE, p_actor_id: actorId })
  mocks.rpc.mockResolvedValueOnce({ data: { state: db.state() }, error: null })
  expect(await readWorkspaceNoteDocuments(client as never, WORKSPACE, actorId, ID(2))).toBeNull()
  expect(db.state().particleGraph.particles).toHaveLength(4)
  expect(db.writes()).toBe(0)
})
it.each([
  { data: null, error: { code: "42501", message: "Board projection access required." } },
  { data: { state: [] }, error: null },
  { data: {}, error: null },
])("fails closed when canonical projection authority or shape fails: %j", async response => {
  database(fixture())
  mocks.actor.mockResolvedValue({ supabase: restrictedClient(), user: { id: actorId }, activeOrg: { orgId: WORKSPACE, role: "staff" } })
  mocks.rpc.mockResolvedValueOnce(response)
  expect(await loadWorkspaceParticleGraphAction()).toMatchObject({ ok: false, code: "unavailable" })
})
it("never elevates ordinary database failures or caches source permissions", async () => {
  database(fixture())
  mocks.actor.mockResolvedValue({ supabase: restrictedClient({ code: "42501", message: "Other policy denial" }), user: { id: actorId }, activeOrg: { orgId: WORKSPACE, role: "staff" } })
  expect(await loadWorkspaceParticleGraphAction()).toMatchObject({ ok: false, code: "unavailable" })
  expect(mocks.rpc).not.toHaveBeenCalled()
})

it("uses the canvas projection for both workspace and source denials, withholding hidden names and bodies", async () => {
  const visibleId = ID(70), hiddenId = ID(71)
  const visible = graph([particle(4)])
  const projected = { workspaceCatalog: { version: 1, defaultName: "Workspace", defaultDeleted: true, entries: [
    { id: visibleId, name: "Communications", createdAt: NOW, updatedAt: NOW, state: { particleGraph: visible } },
  ] } }
  const client = restrictedClient({ code: "42501", message: "Workspace audience access required." })
  mocks.actor.mockResolvedValue({ supabase: client, user: { id: actorId }, activeOrg: { orgId: WORKSPACE, role: "staff" } })
  mocks.rpc.mockImplementation(async (name: string) => name === "read_workspace_canvas_projection"
    ? { data: { state: projected }, error: null } : { data: [], error: null })
  expect(await loadWorkspaceParticleGraphAction(visibleId)).toMatchObject({ ok: true, value: { particles: [expect.objectContaining({ id: ID(4) })] } })
  expect(await loadWorkspaceParticleGraphAction(hiddenId)).toMatchObject({ ok: false, code: "scope" })
  expect(await loadWorkspaceParticleGraphAction()).toMatchObject({ ok: false, code: "scope" })
  expect(mocks.rpc).not.toHaveBeenCalledWith("read_workspace_particle_board_for_projection", expect.anything())
  // A subsequent revoked read cannot reuse the former projected state.
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Board projection access required." } })
  expect(await loadWorkspaceParticleGraphAction(visibleId)).toMatchObject({ ok: false, code: "unavailable" })
})

function downstreamFixture(profile: Record<string, unknown> = {}) {
  const event = (id: number, title: string) => {
    const item = particle(id)
    if (item.type !== "activity") throw new Error("fixture")
    item.title = title
    item.data.widget = { kind: "event", startsAt: NOW, location: title, attendees: [] }
    return item
  }
  const privateEvent = event(60, "Secret event"), publicEvent = event(61, "Public event")
  const namedPrivate = event(62, "Secret named event"), namedPublic = event(63, "Public named event")
  // Detached events remain dependent on their immutable native-file inputs.
  retained = [privateEvent, namedPrivate].map(item => ({ id: `particle:${item.id}`, fileIds: [fileId], complete: false }))
  const state = { particleGraph: graph([privateEvent, publicEvent]), workspaceCatalog: {
    version: 1, defaultName: "Main", entries: [{ id: ID(70), name: "Named", createdAt: NOW, updatedAt: NOW,
      state: { particleGraph: graph([namedPrivate, namedPublic]) } }],
  } }
  let boardError: { code: string; message: string } | null = { code: "42501", message: "Board source access required." }
  let projectionError = false
  const authority = mocks.rpc.getMockImplementation()!
  mocks.rpc.mockImplementation(async (name: string, args: unknown) => name === "read_workspace_canvas_projection"
    ? { data: projectionError ? null : { state: structuredClone(state) }, error: projectionError ? { code: "42501", message: "Board projection access required." } : null }
    : authority(name, args))
  const client = { from: (table: string) => {
    const result = () => table === "organization_workspace_boards" ? { data: boardError ? null : { state: structuredClone(state) }, error: boardError }
      : { data: table === "organizations" ? { profile } : [], error: null }
    const chain = { select: () => chain, eq: () => chain, is: () => chain, order: () => chain, limit: () => chain,
      maybeSingle: async () => result(), then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve) }
    return chain
  } }
  return { client, state, direct: () => { boardError = null },
    failBoard: () => { boardError = { code: "42501", message: "Other policy denial" } },
    revokeParent: () => { projectionError = true },
  }
}
const downstreamReaders = [
  { name: "calendar", read: async (client: unknown) => (await readWorkspaceParticleCalendar(client as never, WORKSPACE, actorId)).map(event => ({ id: event.source.particleId, title: event.title, canvasId: event.source.workspaceCanvasId })) },
  { name: "finance sources", read: async (client: unknown) => (await loadOpportunitySourceOptions(client as never, WORKSPACE, actorId)).flatMap(option => option.source.kind === "particle" ? [{ id: option.source.id, title: option.title, href: option.href }] : []) },
]
it.each(downstreamReaders)("projects root/named $name through raw denial and fresh grant/revocation without modifying canonical data", async reader => {
  const f = downstreamFixture(), original = structuredClone(f.state)
  expect((await reader.read(f.client)).map(item => item.id)).toEqual([ID(61), ID(63)])
  expect(mocks.rpc).toHaveBeenCalledWith("read_workspace_canvas_projection", { p_org_id: WORKSPACE, p_actor_id: actorId })
  allowed = true
  expect((await reader.read(f.client)).map(item => item.id)).toEqual([ID(60), ID(61), ID(62), ID(63)])
  allowed = false
  // Direct/elevated transport still receives the same audience projection.
  f.direct()
  const result = await reader.read(f.client)
  expect(result.map(item => item.id)).toEqual([ID(61), ID(63)])
  expect(JSON.stringify(result)).not.toContain("Secret")
  expect(f.state).toEqual(original)
})
it.each(downstreamReaders)("fails $name closed for authority outages, parent loss, other database errors and malformed graphs", async reader => {
  const f = downstreamFixture()
  failRead = true
  await expect(reader.read(f.client)).rejects.toThrow("could not be verified")
  failRead = false; f.revokeParent()
  await expect(reader.read(f.client)).rejects.toThrow()
  f.failBoard(); mocks.rpc.mockClear()
  await expect(reader.read(f.client)).rejects.toThrow()
  expect(mocks.rpc).not.toHaveBeenCalled()
  f.direct(); f.state.workspaceCatalog.entries[0].state.particleGraph.schemaVersion = 99 as never
  await expect(reader.read(f.client)).rejects.toThrow()
})
it("preserves named-canvas navigation for visible calendar and finance sources", async () => {
  const f = downstreamFixture()
  const events = await readWorkspaceParticleCalendar(f.client as never, WORKSPACE, actorId)
  expect(events[1].source).toMatchObject({ particleId: ID(63), workspaceCanvasId: ID(70) })
  const options = await loadOpportunitySourceOptions(f.client as never, WORKSPACE, actorId)
  expect(options.find(option => option.source.kind === "particle" && option.source.id === ID(63))?.href).toBe(`/workspace?workspace=${ID(70)}`)
})

it("keeps Accelerator progress usable on mixed-audience boards without disclosing any board content", async () => {
  const f = downstreamFixture()
  const progress = { activeStepId: "lesson-2", completedStepIds: ["lesson-1"] }
  Object.assign(f.state, { accelerator: { ...progress, privateExtra: "Secret extra" },
    tracker: { tickets: [{ title: "Secret legacy ticket" }] }, particles: { title: "Secret old graph" } })
  const original = structuredClone(f.state)
  const read = () => readWorkspaceAcceleratorBoardState(f.client as never, WORKSPACE, actorId)
  const result = await read()
  expect(result.accelerator).toEqual(progress)
  expect(JSON.stringify(result)).not.toContain("Secret")
  expect(result).not.toHaveProperty("particleGraph")
  expect(result).not.toHaveProperty("workspaceCatalog")
  expect(mocks.rpc).toHaveBeenCalledWith("read_workspace_canvas_projection", { p_org_id: WORKSPACE, p_actor_id: actorId })
  // Even a full-access/direct transport gets the same thin seed.
  f.direct()
  for (const canReadFile of [true, false]) {
    allowed = canReadFile
    const direct = await read()
    expect(direct.accelerator).toEqual(progress)
    expect(JSON.stringify(direct)).not.toContain("Secret")
    expect(direct).not.toHaveProperty("particleGraph")
    expect(direct).not.toHaveProperty("workspaceCatalog")
  }
  expect(f.state).toEqual(original)
})

it("does not reset Accelerator progress when parent access or the board read fails", async () => {
  const f = downstreamFixture()
  f.revokeParent()
  await expect(readWorkspaceAcceleratorBoardState(f.client as never, WORKSPACE, actorId)).rejects.toThrow()
  f.failBoard(); mocks.rpc.mockClear()
  await expect(readWorkspaceAcceleratorBoardState(f.client as never, WORKSPACE, actorId)).rejects.toThrow()
  expect(mocks.rpc).not.toHaveBeenCalled()
})

it("retains first-use Accelerator defaults only for an absent board or missing legacy table", async () => {
  for (const error of [null, { code: "42P01", message: 'relation "organization_workspace_boards" does not exist' }]) {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error }) }
    const client = { from: () => query }
    const result = await readWorkspaceAcceleratorBoardState(client as never, WORKSPACE, actorId)
    expect(result.accelerator).toEqual({ activeStepId: null, completedStepIds: [] })
    expect(result).not.toHaveProperty("particleGraph")
  }
  expect(mocks.admin).not.toHaveBeenCalled()
})

it.each(["42501", "57014"])("does not mistake %s errors naming the board table for a missing table", async code => {
  const error = { code, message: "Unable to read organization_workspace_boards" }
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error }) }
  await expect(readWorkspaceAcceleratorBoardState({ from: () => query } as never, WORKSPACE, actorId)).rejects.toThrow()
  expect(mocks.admin).not.toHaveBeenCalled()
})


it("filters saved core document copies through the real funding loader without removing other sources", async () => {
  const f = downstreamFixture({ roadmap: { sections: [{ id: "vision", title: "Private saved document", content: "Private body" }] } })
  const authority = mocks.rpc.getMockImplementation()!
  let blocked = false, unavailable = false
  mocks.rpc.mockImplementation(async (name: string, args: unknown) => name === "read_workspace_ai_document_copy_sources"
    ? { data: { blockedSectionIds: blocked ? ["vision"] : [], complete: false }, error: unavailable ? { message: "Private detail" } : null }
    : authority(name, args))
  const read = () => loadOpportunitySourceOptions(f.client as never, WORKSPACE, actorId)
  expect((await read()).some(option => option.title === "Private saved document")).toBe(true)
  blocked = true
  const options = await read()
  expect(JSON.stringify(options)).not.toContain("Private")
  expect(options.some(option => option.source.kind === "particle" && option.source.id === ID(63))).toBe(true)
  unavailable = true
  await expect(read()).rejects.toThrow("sources could not be verified")
})

it("denies a hidden canvas before compiling any canonical graph", async () => {
  const db = database(fixture()), buildState = vi.fn(stored => stored!)
  canvasVisible = false
  expect(await persistWorkspaceBoardState({ supabase: db.client as never, orgId: WORKSPACE, userId: actorId, buildState })).toHaveProperty("error")
  expect(buildState).not.toHaveBeenCalled()
  expect(db.writes()).toBe(0)
})
it("denies a previously successful batch replay after canvas revocation", async () => {
  const initial = fixture(), db = database(initial)
  const change = batch(74, [{ kind: "put_particle", particle: { ...initial.particles[3], title: "Visible edit" }, expectedRevision: 0 }])
  expect(await writeWorkspaceParticleBatch(change)).toMatchObject({ ok: true })
  canvasVisible = false
  const result = await writeWorkspaceParticleBatch(change)
  expect(result).toMatchObject({ ok: false })
  expect(result).not.toHaveProperty("value")
  expect(db.writes()).toBe(1)
})
it("rechecks canvas admission on CAS retry without compiling another snapshot", async () => {
  const db = database(fixture()), buildState = vi.fn(stored => stored!)
  db.beforeUpdate(() => { db.collaborate(); canvasVisible = false })
  expect(await persistWorkspaceBoardState({ supabase: db.client as never, orgId: WORKSPACE, userId: actorId, buildState })).toHaveProperty("error")
  expect(buildState).toHaveBeenCalledTimes(1)
  expect(db.writes()).toBe(0)
})
it.each([2, 3])("withholds graph, receipts and undo when canvas access changes at response check %s", async check => {
  const initial = fixture(), db = database(initial)
  allowed = true; revokeOnCanvasRead = check
  const result = await writeWorkspaceParticleBatch(batch(75, [{ kind: "remove_particle", id: initial.particles[3].id, expectedRevision: 0 }]))
  expect(result).toMatchObject({ ok: false })
  expect(result).not.toHaveProperty("value")
  expect(JSON.stringify(result)).not.toContain("Secret")
  expect(db.writes()).toBe(1)
  expect(db.state().particleGraph.particles.some(item => item.id === initial.particles[3].id)).toBe(false)
})
