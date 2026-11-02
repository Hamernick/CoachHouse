import { createHash } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { handlePageImage } from "@/features/workspace-sharing/server/page-image-reader"
import { handlePageImagePreview } from "@/features/workspace-sharing/server/page-image-preview"
import { handlePageImageCleanup } from "@/features/workspace-sharing/server/page-image-cleanup"
import { ID, WORKSPACE } from "./fixtures/particle-fixtures"

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), storage: vi.fn(), download: vi.fn(), remove: vi.fn(),
  user: vi.fn(), actor: vi.fn(), sources: vi.fn(), images: vi.fn(), flags: { publicSharingEnabled: true } }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc, storage: { from: mocks.storage } }) }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.user } }) }))
vi.mock("@/lib/feature-flags", () => mocks.flags)
vi.mock("@/features/workspace-sharing/server/page-context", () => ({ loadPageActor: mocks.actor, loadSavedPageSources: mocks.sources }))
vi.mock("@/features/workspace-sharing/server/page-asset-sources", () => ({ resolvePageImageSources: mocks.images }))
const bytes = Buffer.from("approved representation")
const sha256 = createHash("sha256").update(bytes).digest("hex")
const grant = { path: `${WORKSPACE}/${ID(10)}/${ID(30)}.webp`, sha256, size: bytes.length }
const request = (audience = "public") => new Request(`https://fixture.test/api/public/workspace-page-assets/${ID(40)}?audience=${audience}`)
const preview = () => new Request(`https://fixture.test/api/account/workspace-page-image?particleId=${ID(1)}&digest=${sha256}&canvasId=${ID(50)}`)

beforeEach(() => {
  vi.resetAllMocks()
  mocks.flags.publicSharingEnabled = true
  mocks.rpc.mockResolvedValue({ data: grant, error: null })
  mocks.storage.mockReturnValue({ download: mocks.download, remove: mocks.remove })
  mocks.download.mockResolvedValue({ data: new Blob([bytes]), error: null })
  mocks.remove.mockResolvedValue({ error: null })
  mocks.user.mockResolvedValue({ data: { user: { id: ID(2) } }, error: null })
  mocks.actor.mockResolvedValue({ actorId: WORKSPACE, orgId: WORKSPACE })
  mocks.sources.mockResolvedValue({ graph: { private: "server-only" } })
  mocks.images.mockResolvedValue(new Map([[ID(1), { representation: { bytes, sha256 } }]]))
})

describe("direct image grants", () => {
  it("serves only committed bytes after two current grant checks, without redirect or cache", async () => {
    const response = await handlePageImage(request(), ID(40))
    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
    expect(response.headers.get("content-type")).toBe("image/webp")
    for (const header of ["cache-control", "cdn-cache-control", "vercel-cdn-cache-control"])
      expect(response.headers.get(header)).toContain("no-store")
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
    expect(mocks.user).not.toHaveBeenCalled()
    expect(mocks.storage).toHaveBeenCalledWith("workspace-page-assets")
  })
  it("denies missing grants without opening Storage", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect((await handlePageImage(request(), ID(40))).status).toBe(404)
    expect(mocks.storage).not.toHaveBeenCalled()
  })
  it.each(["../private", "foreign-org/library/private.png", `https://bucket.test/${ID(30)}.webp`])("rejects a malformed grant path %s", async (path) => {
    mocks.rpc.mockResolvedValue({ data: { ...grant, path }, error: null })
    expect((await handlePageImage(request(), ID(40))).status).toBe(404)
    expect(mocks.download).not.toHaveBeenCalled()
  })
  it("denies a publication revoked during the download", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: grant, error: null }).mockResolvedValueOnce({ data: null, error: null })
    expect((await handlePageImage(request(), ID(40))).status).toBe(404)
  })
  it("denies changed reviewed bytes despite unchanged size", async () => {
    mocks.download.mockResolvedValue({ data: new Blob([Buffer.alloc(bytes.length)]), error: null })
    expect((await handlePageImage(request(), ID(40))).status).toBe(503)
  })
  it("does not serve a partial storage response or disclose provider errors", async () => {
    mocks.download.mockResolvedValue({ data: null, error: { message: "private-key" } })
    const response = await handlePageImage(request(), ID(40))
    expect(response.status).toBe(503)
    expect(await response.text()).toBe("")
  })
  it.each(["guest", "editor"])("uses verified session identity for %s, never caller actor IDs", async (audience) => {
    const response = await handlePageImage(new Request(request(audience).url + `&actorId=${WORKSPACE}`), ID(40))
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith("read_workspace_page_image", { p_asset_id: ID(40), p_audience: audience, p_actor_id: ID(2) })
    expect(mocks.user).toHaveBeenCalledTimes(2)
  })
  it("does not return bytes after the guest session disappears", async () => {
    mocks.user.mockResolvedValueOnce({ data: { user: { id: ID(2) } }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: null })
    expect((await handlePageImage(request("guest"), ID(40))).status).not.toBe(200)
  })
  it("honors the public feature flag without disabling authenticated guest access", async () => {
    mocks.flags.publicSharingEnabled = false
    expect((await handlePageImage(request(), ID(40))).status).toBe(404)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect((await handlePageImage(request("guest"), ID(40))).status).toBe(200)
  })
  it.each([["bad-id", "public"], [ID(40), "admin"]])("rejects invalid addressing", async (id, audience) => {
    expect((await handlePageImage(request(audience), id)).status).toBe(404)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe("review and orphan recovery", () => {
  it("previews only the current canonical primary logo and rejects ambiguous source requests", async () => {
    const profile = { brandIdentity: { assets: { "primary-logo": { fileId: ID(40) } } } }
    mocks.sources.mockResolvedValue({ graph: {}, profile })
    mocks.images.mockResolvedValue(new Map([["brand-logo", { representation: { bytes, sha256 } }]]))
    const url = `https://fixture.test/api/account/workspace-page-image?logo=primary&digest=${sha256}`
    expect((await handlePageImagePreview(new Request(url))).status).toBe(200)
    expect(mocks.images.mock.calls[0][1]).toMatchObject({ profile, draft: { particleIds: [] } })
    expect((await handlePageImagePreview(new Request(`${url}&particleId=${ID(1)}`))).status).toBe(404)
    expect((await handlePageImagePreview(new Request(url.replace(sha256, "0".repeat(64))))).status).toBe(404)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("previews exact prepared bytes only through the current session and selected saved canvas", async () => {
    expect((await handlePageImagePreview(preview())).status).toBe(200)
    expect(mocks.sources).toHaveBeenCalledWith({ actorId: WORKSPACE, orgId: WORKSPACE }, ID(50))
    expect(mocks.images.mock.calls[0][1].draft.particleIds).toEqual([ID(1)])
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("rejects a stale preview digest without substituting the changed image", async () => {
    mocks.images.mockResolvedValue(new Map([[ID(1), { representation: { bytes, sha256: "0".repeat(64) } }]]))
    expect((await handlePageImagePreview(preview())).status).toBe(404)
  })
  it("denies preview after source access is removed", async () => {
    mocks.actor.mockRejectedValue(new Error("Forbidden"))
    expect((await handlePageImagePreview(preview())).status).toBe(404)
    expect(mocks.images).not.toHaveBeenCalled()
  })
  it("requires cron authentication and removes only the bounded RPC candidates", async () => {
    vi.stubEnv("INTERNAL_CRON_SECRET", "fixture-secret")
    try {
      expect((await handlePageImageCleanup(new Request("https://fixture.test/cron"))).status).toBe(401)
      expect(mocks.rpc).not.toHaveBeenCalled()
      mocks.rpc.mockResolvedValue({ data: [grant.path], error: null })
      const response = await handlePageImageCleanup(new Request("https://fixture.test/cron", { headers: { authorization: "Bearer fixture-secret" } }))
      expect(await response.json()).toEqual({ removed: 1, morePossible: false })
      expect(mocks.remove).toHaveBeenCalledWith([grant.path])
      expect(mocks.storage).toHaveBeenCalledWith("workspace-page-assets")
    } finally { vi.unstubAllEnvs() }
  })
})
