import { beforeEach, describe, expect, it, vi } from "vitest"
import { workspacePageCommandSchema } from "@/features/workspace-sharing"
import { projectWorkspacePage } from "@/features/workspace-sharing/server/page-projection"
import { commitWorkspacePageAction, reviewWorkspacePageAction } from "@/features/workspace-sharing/server/actions"
import { createFileParticle } from "@/features/workspace-particles/lib/particle-file"
import { createImageParticle } from "@/features/workspace-particles/lib/particle-image"
import { graph, ID, NOW, particle, WORKSPACE } from "./fixtures/particle-fixtures"

const mocks = vi.hoisted(() => ({ canvas: vi.fn(), documents: vi.fn(), images: vi.fn(), upload: vi.fn(), actor: vi.fn(), page: vi.fn(), sources: vi.fn(), rpc: vi.fn(), admin: vi.fn(), revalidate: vi.fn(), flags: { publicSharingEnabled: true } }))
vi.mock("@/features/workspace-sharing/server/page-context", async () => ({
  ...await vi.importActual<typeof import("@/features/workspace-sharing/server/page-context")>("@/features/workspace-sharing/server/page-context"),
  loadPageActor: mocks.actor, loadSavedPage: mocks.page, loadSavedPageSources: mocks.sources,
}))
vi.mock("@/features/workspace-sharing/server/page-asset-sources", () => ({ resolvePageImageSources: mocks.images }))
vi.mock("@/features/workspace-sharing/server/page-document-sources", () => ({ resolvePageDocumentSources: mocks.documents }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/lib/feature-flags", () => mocks.flags)
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
const draft = { title: "Gather together", description: "Welcome", particleIds: [ID(2), ID(1)] }
const identity = { pageId: ID(10), expectedRevision: 0 }
const command = { ...identity, operationId: ID(11), intent: "publish", draft }
const sources = () => ({ graph: graph(), canonicalGraph: graph(), profile: { name: "Community table", privateContact: "private@example.com" }, public_slug: "community-table", updated_at: NOW })
const row = (revision = 1) => ({
  id: ID(10), org_id: WORKSPACE, link_id: ID(10), revision, title: draft.title,
  description: draft.description, particle_ids: draft.particleIds, visibility: "private",
  published_snapshot: null, published_at: null, created_at: NOW, updated_at: NOW,
  last_operation_id: ID(11), last_operation_actor: WORKSPACE, last_operation_hash: "a".repeat(64),
})
beforeEach(() => {
  vi.resetAllMocks()
  mocks.canvas.mockReset().mockImplementation(async (_name: string, args: { p_canvas_ids: string[] }) => ({ data: args.p_canvas_ids, error: null }))
  mocks.flags.publicSharingEnabled = true
  mocks.images.mockResolvedValue(new Map())
  mocks.documents.mockResolvedValue(new Map())
  mocks.upload.mockResolvedValue({ error: null })
  mocks.actor.mockResolvedValue({ actorId: WORKSPACE, orgId: WORKSPACE, supabase: {} })
  mocks.page.mockResolvedValue(null)
  mocks.sources.mockResolvedValue(sources())
  mocks.admin.mockReturnValue({ rpc: (name: string, args: unknown) => name === "filter_workspace_page_management_canvases" ? mocks.canvas(name, args) : mocks.rpc(name, args), storage: { from: () => ({ upload: mocks.upload }) } })
  mocks.rpc.mockResolvedValue({ data: { page: row(), replayed: false }, error: null })
})
async function reviewedCommand() {
  const review = await reviewWorkspacePageAction({ ...identity, draft })
  if (!review.ok) throw new Error(review.error)
  return { ...command, reviewToken: review.value.reviewToken }
}

describe("workspace page writer", () => {
  it("explains a form ownership denial without suggesting publication succeeded", async () => {
    const request = await reviewedCommand()
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Form manager required" } })
    const result = await commitWorkspacePageAction(request)
    expect(result).toMatchObject({ ok: false, error: "Only this form's manager can publish it." })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("saves a reviewed guest projection without requiring public publishing", async () => {
    mocks.flags.publicSharingEnabled = false
    const request = { ...await reviewedCommand(), intent: "share_with_guests" }
    const result = await commitWorkspacePageAction(request)
    expect(result.ok).toBe(true)
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_intent: "share_with_guests", p_expected_graph: sources().graph })
    expect(mocks.rpc.mock.calls[0][1].p_snapshot.items.map((item: { id: string }) => item.id)).toEqual(draft.particleIds)
  })

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
    changed.canonicalGraph = structuredClone(changed.graph)
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

describe("immutable publication canvas scope", () => {
  it("includes the named source in review and commit without changing the public snapshot", async () => {
    const review = await reviewWorkspacePageAction({ ...identity, draft, canvasId: ID(70) })
    if (!review.ok) throw new Error(review.error)
    expect(mocks.sources).toHaveBeenCalledWith(expect.objectContaining({ orgId: WORKSPACE }), ID(70))
    expect(JSON.stringify(review.value.snapshot)).not.toContain(ID(70))
    const request = { ...command, canvasId: ID(70), reviewToken: review.value.reviewToken }
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: true })
    expect(mocks.rpc.mock.calls[0][1].p_canvas_id).toBe(ID(70))
  })
  it("rejects moving a review token to another canvas even with identical projected content", async () => {
    const request = await reviewedCommand()
    expect(await commitWorkspacePageAction({ ...request, canvasId: ID(70) })).toMatchObject({ ok: false, code: "conflict" })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each(["save_draft", "publish", "make_private"])("rejects %s from another canvas before sources or commit", async intent => {
    mocks.page.mockResolvedValue({ ...row(), canvas_id: ID(70) })
    const input = { ...command, expectedRevision: 1, intent, operationId: ID(12),
      ...(intent === "publish" ? { reviewToken: "a".repeat(64) } : {}) }
    const request = intent === "make_private" ? { pageId: ID(10), expectedRevision: 1, operationId: ID(12), intent } : input
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: false, code: "scope" })
    expect(mocks.sources).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("revokes a named page after canvas deletion without reading its sources", async () => {
    mocks.page.mockResolvedValue({ ...row(), canvas_id: ID(70) })
    expect(await commitWorkspacePageAction({ pageId: ID(10), canvasId: ID(70), expectedRevision: 1, operationId: ID(12), intent: "make_private" })).toMatchObject({ ok: true })
    expect(mocks.sources).not.toHaveBeenCalled()
    expect(mocks.rpc.mock.calls[0][1].p_canvas_id).toBe(ID(70))
  })
})


describe("reviewed image publication", () => {
  function setupImage() {
    const image = createImageParticle(WORKSPACE, "Photo", { kind: "image", fileId: ID(40), width: 10, height: 10, alt: "Workshop" }, { x: 0, y: 0 }, ID(1), NOW)
    const saved = sources()
    saved.graph = graph([image, particle(2)])
    mocks.sources.mockResolvedValue(saved)
    const source = { id: ID(40), org_id: WORKSPACE, document_kind: null, deleted_at: null, mime_type: "image/png", size_bytes: 10,
      storage_path: `${WORKSPACE}/library/private-original.png`, updated_at: NOW }
    const representation = { version: 1 as const, mimeType: "image/webp" as const, bytes: Buffer.from("approved"), sha256: "b".repeat(64), width: 10, height: 10 }
    mocks.images.mockResolvedValue(new Map([[ID(1), { source, representation }]]))
    return { source, representation }
  }
  it("reviews without uploading and commits an exact image grant with no original path in public JSON", async () => {
    setupImage()
    const request = await reviewedCommand()
    expect(mocks.upload).not.toHaveBeenCalled()
    const result = await commitWorkspacePageAction(request)
    expect(result.ok).toBe(true)
    expect(mocks.upload).toHaveBeenCalledOnce()
    const args = mocks.rpc.mock.calls[0][1]
    expect(args.p_snapshot.items[1].content).toMatchObject({ kind: "image", alt: "Workshop" })
    expect(args.p_image_assets[0]).toMatchObject({ id: args.p_snapshot.items[1].content.assetId, sha256: "b".repeat(64), source: { id: ID(40) } })
    expect(JSON.stringify(args.p_snapshot)).not.toContain("private-original")
    expect(mocks.upload.mock.calls[0][2]).toEqual({ contentType: "image/webp", cacheControl: "0", upsert: false })
  })
  it("invalidates the review if bytes change without a metadata timestamp change", async () => {
    const prepared = setupImage()
    const request = await reviewedCommand()
    mocks.images.mockResolvedValue(new Map([[ID(1), { ...prepared, representation: { ...prepared.representation, sha256: "c".repeat(64) } }]]))
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: false, code: "conflict" })
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("does not call the page commit when preparation upload fails", async () => {
    setupImage()
    const request = await reviewedCommand()
    mocks.upload.mockResolvedValue({ error: { message: "provider private detail" } })
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: false, uncertain: false })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("retains exact retry after an unconfirmed commit without re-reading or re-uploading images", async () => {
    setupImage()
    const request = await reviewedCommand()
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "transport" } })
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: false, uncertain: true })
    mocks.page.mockResolvedValue({ ...row(), last_operation_id: request.operationId })
    mocks.rpc.mockResolvedValue({ data: { page: row(), replayed: true }, error: null })
    mocks.images.mockClear()
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: true })
    expect(mocks.images).not.toHaveBeenCalled()
    expect(mocks.upload).toHaveBeenCalledOnce()
  })
})

describe("reviewed document publication", () => {
  function setupFile() {
    const document = createFileParticle(WORKSPACE, "Guide", { kind: "document", fileId: ID(40), format: "md", name: "Guide.md", size: 10 }, { x: 0, y: 0 }, ID(1), NOW)
    const saved = sources()
    saved.graph = graph([document, particle(2)])
    mocks.sources.mockResolvedValue(saved)
    const source = { id: ID(40), org_id: WORKSPACE, document_kind: null, deleted_at: null, mime_type: "text/markdown", size_bytes: 10,
      storage_path: `${WORKSPACE}/library/private-original.png`, updated_at: NOW }
    const representation = { version: 1 as const, mimeType: "text/plain" as const, bytes: Buffer.from("approved"), sha256: "b".repeat(64), }
    mocks.documents.mockResolvedValue(new Map([[ID(1), { source, representation }]]))
    return { source, representation }
  }
  it("reviews without uploading and commits an exact document grant with no original path in public JSON", async () => {
    setupFile()
    const request = await reviewedCommand()
    expect(mocks.upload).not.toHaveBeenCalled()
    const result = await commitWorkspacePageAction(request)
    expect(result.ok).toBe(true)
    expect(mocks.upload).toHaveBeenCalledOnce()
    const args = mocks.rpc.mock.calls[0][1]
    expect(args.p_snapshot.items[1].content).toMatchObject({ kind: "document", name: "Guide.md" })
    expect(args.p_document_assets[0]).toMatchObject({ id: args.p_snapshot.items[1].content.assetId, sha256: "b".repeat(64), source: { id: ID(40) } })
    expect(JSON.stringify(args.p_snapshot)).not.toContain("private-original")
    expect(mocks.upload.mock.calls[0][2]).toEqual({ contentType: "text/plain", cacheControl: "0", upsert: false })
  })
  it("invalidates the review if bytes change without a metadata timestamp change", async () => {
    const prepared = setupFile()
    const request = await reviewedCommand()
    mocks.documents.mockResolvedValue(new Map([[ID(1), { ...prepared, representation: { ...prepared.representation, sha256: "c".repeat(64) } }]]))
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: false, code: "conflict" })
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("does not call the page commit when preparation upload fails", async () => {
    setupFile()
    const request = await reviewedCommand()
    mocks.upload.mockResolvedValue({ error: { message: "provider private detail" } })
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: false, uncertain: false })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("retains exact retry after an unconfirmed commit without re-reading or re-uploading documents", async () => {
    setupFile()
    const request = await reviewedCommand()
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "transport" } })
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: false, uncertain: true })
    mocks.page.mockResolvedValue({ ...row(), last_operation_id: request.operationId })
    mocks.rpc.mockResolvedValue({ data: { page: row(), replayed: true }, error: null })
    mocks.documents.mockClear()
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: true })
    expect(mocks.documents).not.toHaveBeenCalled()
    expect(mocks.upload).toHaveBeenCalledOnce()
  })
})


describe("sharing source audience", () => {
  it("reviews permitted content but commits the full canonical graph for CAS", async () => {
    const saved = sources()
    saved.canonicalGraph.particles.push({ ...particle(99), title: "Restricted sibling" })
    mocks.sources.mockResolvedValue(saved)
    const request = await reviewedCommand()
    const result = await commitWorkspacePageAction(request)
    expect(result.ok).toBe(true)
    expect(mocks.rpc.mock.calls[0][1].p_expected_graph).toEqual(saved.canonicalGraph)
    expect(mocks.rpc.mock.calls[0][1].p_snapshot.items).toHaveLength(2)
    expect(JSON.stringify(result)).not.toContain("Restricted sibling")
  })
  it("withholds preview when selected access is revoked during asset preparation", async () => {
    const revoked = sources()
    revoked.graph.particles = []
    mocks.sources.mockResolvedValueOnce(sources()).mockResolvedValue(revoked)
    expect(await reviewWorkspacePageAction({ ...identity, draft })).toMatchObject({ ok: false, code: "conflict" })
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("rejects hidden selections before publication and after an earlier review", async () => {
    const request = await reviewedCommand()
    const revoked = sources()
    revoked.graph.particles = []
    mocks.sources.mockResolvedValue(revoked)
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: false, code: "conflict" })
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it("does not treat a source denial at commit as success", async () => {
    const request = await reviewedCommand()
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Board source access required." } })
    expect(await commitWorkspacePageAction(request)).toMatchObject({ ok: false, code: "scope", uncertain: false })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
})

 describe("private canvas sharing authority", () => {
  it("blocks all publication intents before loading source content", async () => {
    mocks.canvas.mockResolvedValue({ data: [], error: null })
    const result = await commitWorkspacePageAction({ ...command, intent: "save_draft" })
    expect(result).toMatchObject({ ok: false })
    expect(mocks.page).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each([false, true])("withholds a save/replay result after revocation (replayed=%s)", async replayed => {
    mocks.rpc.mockImplementation(async () => {
      mocks.canvas.mockResolvedValue({ data: [], error: null })
      return { data: { page: row(), replayed }, error: null }
    })
    const request = await reviewedCommand()
    const result = await commitWorkspacePageAction(request)
    expect(result).toMatchObject({ ok: false, code: "scope" })
    expect(JSON.stringify(result)).not.toContain(draft.title)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
 })
