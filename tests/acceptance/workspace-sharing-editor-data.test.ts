import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadWorkspacePageEditorAction } from "@/features/workspace-sharing/server/actions"
import { WorkspaceSharingError } from "@/features/workspace-sharing/server/page-projection"
import { graph, ID, NOW, WORKSPACE } from "./fixtures/particle-fixtures"

const mocks = vi.hoisted(() => ({ actor: vi.fn(), sources: vi.fn(), page: vi.fn(), from: vi.fn(), read: vi.fn() }))
vi.mock("@/features/workspace-sharing/server/page-context", async (original) => ({
  ...await original<typeof import("@/features/workspace-sharing/server/page-context")>(),
  loadPageActor: mocks.actor, loadSavedPageSources: mocks.sources, loadSavedPage: mocks.page,
}))
const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), abortSignal: mocks.read }
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
