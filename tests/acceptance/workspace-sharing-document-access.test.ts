import { createHash } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { handlePageDocument } from "@/features/workspace-sharing/server/page-document-reader"
import { handlePageDocumentPreview } from "@/features/workspace-sharing/server/page-document-preview"
import { handlePageImageCleanup } from "@/features/workspace-sharing/server/page-image-cleanup"
import { ID, WORKSPACE } from "./fixtures/particle-fixtures"

const mocks = vi.hoisted(() => ({ canvas: vi.fn(), rpc: vi.fn(), storage: vi.fn(), download: vi.fn(), remove: vi.fn(),
  user: vi.fn(), actor: vi.fn(), sources: vi.fn(), documents: vi.fn(), flags: { publicSharingEnabled: true } }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: (name: string, args: unknown) => name === "filter_workspace_page_management_canvases" ? mocks.canvas(name, args) : mocks.rpc(name, args), storage: { from: mocks.storage } }) }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.user } }) }))
vi.mock("@/lib/feature-flags", () => mocks.flags)
vi.mock("@/features/workspace-sharing/server/page-context", () => ({ loadPageActor: mocks.actor, loadSavedPageSources: mocks.sources }))
vi.mock("@/features/workspace-sharing/server/page-document-sources", () => ({ resolvePageDocumentSources: mocks.documents }))
const bytes = Buffer.from("approved representation")
const sha256 = createHash("sha256").update(bytes).digest("hex")
const grant = { path: `${WORKSPACE}/${ID(10)}/${ID(30)}.txt`, sha256, size: bytes.length }
const request = (audience = "public") => new Request(`https://fixture.test/api/public/workspace-page-documents/${ID(40)}?audience=${audience}`)
const preview = () => new Request(`https://fixture.test/api/account/workspace-page-document?particleId=${ID(1)}&digest=${sha256}&canvasId=${ID(50)}`)

beforeEach(() => {
  vi.resetAllMocks()
  mocks.canvas.mockReset().mockImplementation(async (_name: string, args: { p_canvas_ids: string[] }) => ({ data: args.p_canvas_ids, error: null }))
  mocks.flags.publicSharingEnabled = true
  mocks.rpc.mockResolvedValue({ data: grant, error: null })
  mocks.storage.mockReturnValue({ download: mocks.download, remove: mocks.remove })
  mocks.download.mockResolvedValue({ data: new Blob([bytes]), error: null })
  mocks.remove.mockResolvedValue({ error: null })
  mocks.user.mockResolvedValue({ data: { user: { id: ID(2) } }, error: null })
  mocks.actor.mockResolvedValue({ actorId: WORKSPACE, orgId: WORKSPACE })
  mocks.sources.mockResolvedValue({ graph: { private: "server-only" } })
  mocks.documents.mockResolvedValue(new Map([[ID(1), { representation: { bytes, sha256 } }]]))
})

describe("direct document grants", () => {
  it("serves only committed bytes after two current grant checks, without redirect or cache", async () => {
    const response = await handlePageDocument(request(), ID(40))
    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8")
    for (const header of ["cache-control", "cdn-cache-control", "vercel-cdn-cache-control"])
      expect(response.headers.get(header)).toContain("no-store")
    expect(response.headers.get("content-security-policy")).toContain("sandbox")
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
    expect(mocks.user).not.toHaveBeenCalled()
    expect(mocks.storage).toHaveBeenCalledWith("workspace-page-assets")
  })
  it("denies missing grants without opening Storage", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect((await handlePageDocument(request(), ID(40))).status).toBe(404)
    expect(mocks.storage).not.toHaveBeenCalled()
  })
  it.each(["../private", "foreign-org/library/private.png", `https://bucket.test/${ID(30)}.txt`])("rejects a malformed grant path %s", async (path) => {
    mocks.rpc.mockResolvedValue({ data: { ...grant, path }, error: null })
    expect((await handlePageDocument(request(), ID(40))).status).toBe(404)
    expect(mocks.download).not.toHaveBeenCalled()
  })
  it("denies a publication revoked during the download", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: grant, error: null }).mockResolvedValueOnce({ data: null, error: null })
    expect((await handlePageDocument(request(), ID(40))).status).toBe(404)
  })
  it("denies changed reviewed bytes despite unchanged size", async () => {
    mocks.download.mockResolvedValue({ data: new Blob([Buffer.alloc(bytes.length)]), error: null })
    expect((await handlePageDocument(request(), ID(40))).status).toBe(503)
  })
  it("does not serve a partial storage response or disclose provider errors", async () => {
    mocks.download.mockResolvedValue({ data: null, error: { message: "private-key" } })
    const response = await handlePageDocument(request(), ID(40))
    expect(response.status).toBe(503)
    expect(await response.text()).toBe("")
  })
  it.each(["guest", "editor"])("uses verified session identity for %s, never caller actor IDs", async (audience) => {
    const response = await handlePageDocument(new Request(request(audience).url + `&actorId=${WORKSPACE}`), ID(40))
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith("read_workspace_page_document", { p_asset_id: ID(40), p_audience: audience, p_actor_id: ID(2) })
    expect(mocks.user).toHaveBeenCalledTimes(2)
  })
  it("does not return bytes after the guest session disappears", async () => {
    mocks.user.mockResolvedValueOnce({ data: { user: { id: ID(2) } }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: null })
    expect((await handlePageDocument(request("guest"), ID(40))).status).not.toBe(200)
  })
  it("honors the public feature flag without disabling authenticated guest access", async () => {
    mocks.flags.publicSharingEnabled = false
    expect((await handlePageDocument(request(), ID(40))).status).toBe(404)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect((await handlePageDocument(request("guest"), ID(40))).status).toBe(200)
  })
  it.each([["bad-id", "public"], [ID(40), "admin"]])("rejects invalid addressing", async (id, audience) => {
    expect((await handlePageDocument(request(audience), id)).status).toBe(404)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe("review and orphan recovery", () => {
  it("previews exact prepared bytes only through the current session and selected saved canvas", async () => {
    expect((await handlePageDocumentPreview(preview())).status).toBe(200)
    expect(mocks.sources).toHaveBeenCalledWith({ actorId: WORKSPACE, orgId: WORKSPACE }, ID(50))
    expect(mocks.documents.mock.calls[0][1].draft.particleIds).toEqual([ID(1)])
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("rejects a stale preview digest without substituting the changed document", async () => {
    mocks.documents.mockResolvedValue(new Map([[ID(1), { representation: { bytes, sha256: "0".repeat(64) } }]]))
    expect((await handlePageDocumentPreview(preview())).status).toBe(404)
  })
  it("denies preview after source access is removed", async () => {
    mocks.actor.mockRejectedValue(new Error("Forbidden"))
    expect((await handlePageDocumentPreview(preview())).status).toBe(404)
    expect(mocks.documents).not.toHaveBeenCalled()
  })
  it("requires cron authentication and removes only the bounded RPC candidates", async () => {
    vi.stubEnv("INTERNAL_CRON_SECRET", "fixture-secret")
    try {
      expect((await handlePageImageCleanup(new Request("https://fixture.test/cron"))).status).toBe(401)
      expect(mocks.rpc).not.toHaveBeenCalled()
      mocks.rpc.mockResolvedValue({ data: [grant.path], error: null })
      const response = await handlePageImageCleanup(new Request("https://fixture.test/cron", { headers: { authorization: "Bearer fixture-secret" } }))
      expect(await response.json()).toEqual({ removed: 1, morePossible: true })
      expect(mocks.remove).toHaveBeenCalledWith([grant.path])
      expect(mocks.storage).toHaveBeenCalledWith("workspace-page-assets")
    } finally { vi.unstubAllEnvs() }
  })
})

 describe("preview canvas revocation", () => {
  it("discards bytes prepared before canvas management was revoked", async () => {
    mocks.documents.mockImplementation(async () => {
      mocks.canvas.mockResolvedValue({ data: [], error: null })
      return new Map([[ID(1), { representation: { bytes, sha256 } }]])
    })
    const result = await handlePageDocumentPreview(preview())
    expect(result.status).toBe(404)
    expect(await result.text()).not.toContain("approved representation")
  })
 })
