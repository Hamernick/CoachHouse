import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadWorkspacePageEditorAction } from "@/features/workspace-sharing/server/actions"
import { WorkspaceSharingError } from "@/features/workspace-sharing/server/page-projection"
import { graph, ID, NOW, WORKSPACE } from "./fixtures/particle-fixtures"

const mocks = vi.hoisted(() => ({ actor: vi.fn(), sources: vi.fn(), page: vi.fn(), from: vi.fn(), read: vi.fn() }))
vi.mock("@/features/workspace-sharing/server/page-context", async (original) => ({
  ...await original<typeof import("@/features/workspace-sharing/server/page-context")>(),
  loadPageActor: mocks.actor, loadSavedPageSources: mocks.sources, loadSavedPage: mocks.page,
}))
const query = { gt: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), abortSignal: mocks.read }
const request = { workspaceId: WORKSPACE, particleId: ID(1) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.actor.mockResolvedValue({ actorId: WORKSPACE, orgId: WORKSPACE, supabase: { from: mocks.from } })
  mocks.from.mockReturnValue(query)
  mocks.sources.mockResolvedValue({ graph: graph(), profile: { name: "Table", privateEmail: "private@example.com" }, public_slug: "table", updated_at: NOW })
  mocks.read.mockResolvedValue({ data: [], error: null }); mocks.page.mockResolvedValue(null)
})
describe("Share editor data is scoped and bounded", () => {
  it("returns thin recent-page choices, not every page snapshot or the raw graph", async () => {
    const result = await loadWorkspacePageEditorAction(request)
    expect(result.ok).toBe(true)
    expect(query.select).toHaveBeenCalledWith("id,title,visibility,particle_ids")
    expect(query.eq).toHaveBeenCalledWith("org_id", WORKSPACE)
    expect(query.limit).toHaveBeenCalledWith(50)
    expect(JSON.stringify(result)).not.toContain("private@example.com")
    expect(JSON.stringify(result)).not.toContain('"graph"')
  })
  it("rejects forged/cross-workspace context before reading page/source data", async () => {
    expect(await loadWorkspacePageEditorAction({ ...request, workspaceId: ID(99) })).toMatchObject({ ok: false, code: "scope", uncertain: false })
    expect(mocks.sources).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled()
  })
  it("rejects missing or still-unsaved Particles", async () => {
    expect(await loadWorkspacePageEditorAction({ ...request, particleId: ID(99) })).toMatchObject({ ok: false, code: "conflict", uncertain: false })
  })
  it("validates every initial selected ID and keeps a multi-card share as a new page", async () => {
    const result = await loadWorkspacePageEditorAction({ ...request, initialParticleIds: [ID(2), ID(1), ID(2)] })
    expect(result).toMatchObject({ ok: true, value: { page: null, initialParticleIds: [ID(2), ID(1)] } })
    expect(mocks.page).not.toHaveBeenCalled()
    expect(await loadWorkspacePageEditorAction({ ...request, initialParticleIds: [ID(1), ID(99)] })).toMatchObject({ ok: false, code: "conflict" })
    expect(await loadWorkspacePageEditorAction({ ...request, initialParticleIds: Array.from({ length: 51 }, (_, i) => ID(i + 1)) })).toMatchObject({ ok: false, code: "invalid" })
  })
  it("does not expose data after a role/auth failure", async () => {
    mocks.actor.mockRejectedValue(new WorkspaceSharingError("scope", "Editor required"))
    expect(await loadWorkspacePageEditorAction(request)).toMatchObject({ ok: false, code: "scope" })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it("rejects an inaccessible selected page without creating another one", async () => {
    expect(await loadWorkspacePageEditorAction({ ...request, pageId: ID(55) })).toMatchObject({ ok: false, code: "conflict" })
    expect(mocks.page).toHaveBeenCalledWith(expect.objectContaining({ orgId: WORKSPACE }), ID(55))
  })
})

describe("Share canvas identity", () => {
  it("filters recent pages and sources to the requested named canvas", async () => {
    const result = await loadWorkspacePageEditorAction({ ...request, canvasId: ID(70) })
    expect(result).toMatchObject({ ok: true, value: { canvasId: ID(70) } })
    expect(query.eq).toHaveBeenCalledWith("canvas_id", ID(70))
    expect(mocks.sources).toHaveBeenCalledWith(expect.objectContaining({ orgId: WORKSPACE }), ID(70))
  })
  it("keeps legacy requests on the root and rejects pages from a sibling canvas", async () => {
    await loadWorkspacePageEditorAction(request)
    expect(query.is).toHaveBeenCalledWith("canvas_id", null)
    mocks.page.mockResolvedValue({ canvas_id: ID(71) })
    expect(await loadWorkspacePageEditorAction({ ...request, canvasId: ID(70), pageId: ID(55) }))
      .toMatchObject({ ok: false, code: "conflict" })
  })
})

describe("saved sharing sources resolve exactly one live canvas", () => {
  async function load(state: unknown, canvasId: string | null = null) {
    const { loadSavedPageSources } = await vi.importActual<typeof import("@/features/workspace-sharing/server/page-context")>("@/features/workspace-sharing/server/page-context")
    const { createClient } = await import("@supabase/supabase-js")
    const supabase = createClient<import("@/lib/supabase").Database>("https://fixture.invalid", "fixture")
    const result = (data: unknown) => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: async () => ({ data, error: null }) }) }) }) })
    const from = vi.fn()
    from.mockImplementation((table: string) => result(table === "organizations"
      ? { profile: { name: "Table" }, public_slug: "table", updated_at: NOW } : { state }))
    vi.spyOn(supabase, "from").mockImplementation(from)
    return loadSavedPageSources({ actorId: WORKSPACE, orgId: WORKSPACE, supabase }, canvasId)
  }
  const namedGraph = () => ({ ...graph(), revision: 7 })
  const board = () => ({ particleGraph: graph(), workspaceCatalog: { version: 1, defaultName: "Main", entries: [
    { id: ID(70), name: "Named", createdAt: NOW, updatedAt: NOW, state: { particleGraph: namedGraph() } },
  ] } })
  it("reads the requested graph even when root and named canvas reuse an item ID", async () => {
    expect((await load(board(), ID(70))).graph).toEqual(namedGraph())
    expect((await load(board())).graph).toEqual(graph())
  })
  it("rejects missing, duplicate and deleted canvases without falling back to root", async () => {
    await expect(load(board(), ID(71))).rejects.toThrow("unavailable")
    const duplicate = board(); duplicate.workspaceCatalog.entries.push(duplicate.workspaceCatalog.entries[0])
    await expect(load(duplicate, ID(70))).rejects.toThrow("unavailable")
    await expect(load({ ...board(), workspaceCatalog: { ...board().workspaceCatalog, defaultDeleted: true } })).rejects.toThrow("unavailable")
  })
  it("rejects a malformed catalog and absent named graph", async () => {
    await expect(load({ particleGraph: graph(), workspaceCatalog: { invalid: true } })).rejects.toThrow("Unable to read")
    const saved = board()
    const missing = { ...saved, workspaceCatalog: { ...saved.workspaceCatalog, entries: [{ ...saved.workspaceCatalog.entries[0], state: {} }] } }
    await expect(load(missing, ID(70))).rejects.toThrow("Save a Particle")
  })
})


describe("source-independent shared-page recovery", () => {
  async function directory(input: unknown = {}) {
    const { loadWorkspacePageDirectoryAction } = await import("@/features/workspace-sharing/directory-actions")
    return loadWorkspacePageDirectoryAction(input)
  }
  it("lists only thin authorized organization metadata without resolving deleted canvases", async () => {
    mocks.sources.mockRejectedValue(new Error("Canvas deleted"))
    mocks.read.mockResolvedValue({ data: [{ id: ID(12), title: "Saved page", visibility: "public" }], error: null })
    expect(await directory()).toMatchObject({ ok: true, value: { workspaceId: WORKSPACE, pages: [{ id: ID(12) }], next: null } })
    expect(query.select).toHaveBeenCalledWith("id,title,visibility")
    expect(query.eq).toHaveBeenCalledWith("org_id", WORKSPACE)
    expect(query.eq).not.toHaveBeenCalledWith("canvas_id", expect.anything())
    expect(query.is).not.toHaveBeenCalled()
    expect(mocks.sources).not.toHaveBeenCalled()
  })
  it("uses a bounded immutable-ID cursor so older pages remain discoverable", async () => {
    mocks.read.mockResolvedValue({ data: Array.from({ length: 26 }, (_, i) => ({ id: ID(i + 30), title: "Page", visibility: "private" })), error: null })
    const result = await directory({ after: ID(29) })
    expect(result).toMatchObject({ ok: true, value: { next: ID(54) } })
    if (result.ok) expect(result.value.pages).toHaveLength(25)
    expect(query.gt).toHaveBeenCalledWith("id", ID(29)); expect(query.limit).toHaveBeenCalledWith(26)
    expect(query.order).toHaveBeenCalledWith("id")
  })
  it("denies unauthorized discovery and rejects forged actor or organization input", async () => {
    expect(await directory({ orgId: ID(99) })).toMatchObject({ ok: false })
    expect(mocks.actor).not.toHaveBeenCalled()
    mocks.actor.mockRejectedValue(new WorkspaceSharingError("scope", "Editor required"))
    expect(await directory()).toMatchObject({ ok: false, error: "Editor required" })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it("loads saved management data without exposing receipts or needing source records", async () => {
    const { loadWorkspacePageManagementAction: manage } = await import("@/features/workspace-sharing/directory-actions")
    mocks.page.mockResolvedValue({ id: ID(12), org_id: WORKSPACE, canvas_id: ID(70), link_id: ID(15), revision: 2,
      title: "Saved page", description: "", particle_ids: [ID(1)], visibility: "private", published_snapshot: null,
      guest_snapshot: { private: "never return raw grant snapshot" }, published_at: null, created_at: NOW, updated_at: NOW,
      last_operation_hash: "never return receipt" })
    const result = await manage({ pageId: ID(12) })
    expect(result).toMatchObject({ ok: true, value: { canvasId: ID(70), guestSharingReady: true } })
    expect(JSON.stringify(result)).not.toContain("never return")
    expect(mocks.page).toHaveBeenCalledWith(expect.objectContaining({ orgId: WORKSPACE }), ID(12))
    expect(mocks.sources).not.toHaveBeenCalled()
    mocks.page.mockResolvedValue(null)
    expect(await manage({ pageId: ID(99) })).toMatchObject({ ok: false })
  })
  it("returns a retryable load error instead of treating a failed query as an empty list", async () => {
    mocks.read.mockResolvedValue({ data: null, error: { message: "private database details" } })
    const result = await directory()
    expect(result).toMatchObject({ ok: false })
    expect(JSON.stringify(result)).not.toContain("private database details")
  })
})
