import { beforeEach, describe, expect, it, vi } from "vitest"
import { workspacePageCommandSchema } from "@/features/workspace-sharing"
import { projectWorkspacePage } from "@/features/workspace-sharing/server/page-projection"
import { commitWorkspacePageAction, reviewWorkspacePageAction } from "@/features/workspace-sharing/server/actions"
import { graph, ID, NOW, particle, WORKSPACE } from "./fixtures/particle-fixtures"

const mocks = vi.hoisted(() => ({ actor: vi.fn(), page: vi.fn(), sources: vi.fn(), rpc: vi.fn(), admin: vi.fn(), revalidate: vi.fn(), flags: { publicSharingEnabled: true } }))
vi.mock("@/features/workspace-sharing/server/page-context", async () => ({
  ...await vi.importActual<typeof import("@/features/workspace-sharing/server/page-context")>("@/features/workspace-sharing/server/page-context"),
  loadPageActor: mocks.actor, loadSavedPage: mocks.page, loadSavedPageSources: mocks.sources,
}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/lib/feature-flags", () => mocks.flags)
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
const draft = { title: "Gather together", description: "Welcome", particleIds: [ID(2), ID(1)] }
const identity = { pageId: ID(10), expectedRevision: 0 }
const command = { ...identity, operationId: ID(11), intent: "publish", draft }
const sources = () => ({ graph: graph(), profile: { name: "Community table", privateContact: "private@example.com" }, public_slug: "community-table", updated_at: NOW })
const row = (revision = 1) => ({
  id: ID(10), org_id: WORKSPACE, link_id: ID(10), revision, title: draft.title,
  description: draft.description, particle_ids: draft.particleIds, visibility: "private",
  published_snapshot: null, published_at: null, created_at: NOW, updated_at: NOW,
  last_operation_id: ID(11), last_operation_actor: WORKSPACE, last_operation_hash: "a".repeat(64),
})
beforeEach(() => {
  vi.resetAllMocks()
  mocks.flags.publicSharingEnabled = true
  mocks.actor.mockResolvedValue({ actorId: WORKSPACE, orgId: WORKSPACE, supabase: {} })
  mocks.page.mockResolvedValue(null)
  mocks.sources.mockResolvedValue(sources())
  mocks.admin.mockReturnValue({ rpc: mocks.rpc })
  mocks.rpc.mockResolvedValue({ data: { page: row(), replayed: false }, error: null })
})
async function reviewedCommand() {
  const review = await reviewWorkspacePageAction({ ...identity, draft })
  if (!review.ok) throw new Error(review.error)
  return { ...command, reviewToken: review.value.reviewToken }
}

describe("workspace page writer", () => {
  it("reviews selected saved content in explicit order without private profile fields", async () => {
    const review = await reviewWorkspacePageAction({ ...identity, draft })
    expect(review.ok).toBe(true)
    if (!review.ok) return
    expect(review.value.snapshot.items.map((item) => item.id)).toEqual(draft.particleIds)
    expect(review.value.snapshot.brand).toEqual({ name: "Community table", organizationSlug: "community-table" })
    expect(JSON.stringify(review)).not.toContain("private@example.com")
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("sends only a server-built snapshot with verified actor and exact saved graph to one commit", async () => {
    const request = await reviewedCommand()
    const result = await commitWorkspacePageAction(request)
    expect(result.ok).toBe(true)
    expect(mocks.rpc).toHaveBeenCalledOnce()
    const [name, args] = mocks.rpc.mock.calls[0]
    expect(name).toBe("commit_workspace_page")
    expect(args).toMatchObject({ p_actor_id: WORKSPACE, p_org_id: WORKSPACE, p_page_id: ID(10),
      p_expected_revision: 0, p_expected_graph: sources().graph, p_expected_org_updated_at: NOW })
    expect(args.p_snapshot.items.map((item: { id: string }) => item.id)).toEqual(draft.particleIds)
    expect(mocks.revalidate).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(result)).not.toContain("last_operation_hash")
  })
  it.each(["actorId", "orgId", "snapshot", "visibility", "publishedAt"]) ("rejects client-injected %s before access", async (key) => {
    const result = await commitWorkspacePageAction({ ...command, reviewToken: "a".repeat(64), [key]: "forged" })
    expect(result.ok).toBe(false)
    expect(mocks.actor).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("requires review again after a saved Particle changes", async () => {
    const request = await reviewedCommand()
    const changed = sources()
    changed.graph.particles[0].title = "Unseen edit"
    mocks.sources.mockResolvedValue(changed)
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: false, code: "conflict" })
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("does not invalidate a reviewed publication for unrelated canvas geometry", async () => {
    const request = await reviewedCommand()
    const changed = sources()
    changed.graph.particles[0].position.x += 100
    mocks.sources.mockResolvedValue(changed)
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: true })
    expect(mocks.rpc.mock.calls[0][1].p_expected_graph).toEqual(changed.graph)
  })
  it("rejects a stale page revision before loading sources", async () => {
    mocks.page.mockResolvedValue(row(2))
    expect(await commitWorkspacePageAction({ ...command, reviewToken: "a".repeat(64), operationId: ID(12) })).toMatchObject({ ok: false, code: "conflict" })
    expect(mocks.sources).not.toHaveBeenCalled()
  })
  it("retries a confirmed operation through DB receipt authorization without republishing newer content", async () => {
    const request = await reviewedCommand()
    mocks.page.mockResolvedValue(row())
    mocks.sources.mockClear()
    mocks.rpc.mockResolvedValue({ data: { page: row(), replayed: true }, error: null })
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: true, value: { replayed: true } })
    expect(mocks.sources).not.toHaveBeenCalled()
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_snapshot: null, p_expected_graph: null })
    expect(mocks.revalidate).toHaveBeenCalledTimes(2)
  })
  it("can make Private with missing sources and sharing flag disabled", async () => {
    mocks.flags.publicSharingEnabled = false
    mocks.page.mockResolvedValue(row())
    expect(await commitWorkspacePageAction({ pageId: ID(10), expectedRevision: 1, operationId: ID(12), intent: "make_private" })).toMatchObject({ ok: true })
    expect(mocks.sources).not.toHaveBeenCalled()
    expect(mocks.rpc.mock.calls[0][1].p_snapshot).toBeNull()
  })
  it("saves a private draft without constructing or replacing published content", async () => {
    expect(await commitWorkspacePageAction({ ...command, intent: "save_draft" })).toMatchObject({ ok: true })
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_snapshot: null, p_expected_graph: sources().graph })
  })
  it("blocks publication when sharing is disabled", async () => {
    const request = await reviewedCommand()
    mocks.flags.publicSharingEnabled = false
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: false, code: "unavailable", uncertain: false })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each([["40001", "conflict"], ["42501", "scope"], ["22023", "invalid"], ["XX000", "unavailable"]])(
    "preserves confirmed publication on commit failure %s", async (dbCode, code) => {
      const request = await reviewedCommand()
      mocks.rpc.mockResolvedValue({ data: null, error: { code: dbCode, message: "private database details" } })
      expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: false, code, uncertain: dbCode === "XX000" })
      expect(mocks.revalidate).not.toHaveBeenCalled()
    })
  it("requires exact retry when response invalidation fails after a confirmed commit", async () => {
    const request = await reviewedCommand()
    mocks.revalidate.mockImplementationOnce(() => { throw new Error("Invalidation interrupted") })
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: false, uncertain: true })
    expect(mocks.rpc).toHaveBeenCalledOnce()
  })
  it("does not escalate actor/auth failures to a service-role read", async () => {
    mocks.actor.mockRejectedValue(new Error("private session detail"))
    expect(await commitWorkspacePageAction({ ...command, intent: "save_draft" })).toMatchObject({ ok: false, code: "unavailable" })
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("rejects missing/cross-workspace selections and unsupported private source payloads", () => {
    const base = { orgId: WORKSPACE, profile: sources().profile, publicSlug: "community-table", graph: graph(), draft }
    expect(() => projectWorkspacePage({ ...base, draft: { ...draft, particleIds: [ID(99)] } })).toThrow("removed")
    expect(() => projectWorkspacePage({ ...base, orgId: ID(99) })).toThrow("another workspace")
    expect(() => projectWorkspacePage({ ...base, graph: graph([particle(1, "people")]), draft: { ...draft, particleIds: [ID(1)] } })).toThrow("public preview")
  })
  it("requires a known revision and command for make Private", () => {
    expect(workspacePageCommandSchema.safeParse({ ...identity, operationId: ID(11), intent: "make_private" }).success).toBe(false)
  })
})
