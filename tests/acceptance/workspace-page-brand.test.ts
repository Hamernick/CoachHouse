import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { pageBrandStyle, projectPageBrandColor } from "@/features/workspace-sharing/lib/page-brand"
import { workspacePageSnapshotSchema } from "@/features/workspace-sharing/lib/page-schema"
import { PublicWorkspacePage } from "@/features/workspace-sharing/components/public-workspace-page"
import { reviewWorkspacePageAction, commitWorkspacePageAction } from "@/features/workspace-sharing/server/actions"
import { writeWorkspacePage } from "@/features/workspace-sharing/server/page-service"
import { loadPublicWorkspacePage } from "@/features/workspace-sharing/server/public-page"
import { contrastRatio } from "@/features/nonprofit-documentation"
import { identifyPageImages } from "@/features/workspace-sharing/server/page-image-publication"
import { projectWorkspacePage } from "@/features/workspace-sharing/server/page-projection"
import { graph, ID, NOW, WORKSPACE } from "./fixtures/particle-fixtures"
const mocks = vi.hoisted(() => ({ actor: vi.fn(), page: vi.fn(), sources: vi.fn(), rpc: vi.fn(), images: vi.fn(), upload: vi.fn() }))
vi.mock("@/features/workspace-sharing/server/page-context", async () => ({ ...await vi.importActual<typeof import("@/features/workspace-sharing/server/page-context")>("@/features/workspace-sharing/server/page-context"), loadPageActor: mocks.actor, loadSavedPage: mocks.page, loadSavedPageSources: mocks.sources }))
vi.mock("@/features/workspace-sharing/server/page-asset-sources", () => ({ resolvePageImageSources: mocks.images }))
vi.mock("@/features/workspace-sharing/server/page-document-sources", () => ({ resolvePageDocumentSources: async () => new Map() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc, storage: { from: () => ({ upload: mocks.upload }) } }) }))
vi.mock("@/lib/feature-flags", () => ({ publicSharingEnabled: true }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
const draft = { title: "Reviewed page", description: "", particleIds: [ID(1)] }
const request = { pageId: ID(10), expectedRevision: 0, draft }
const sources = (brandPrimary: unknown = "#3b82f6") => ({ graph: graph(), profile: { name: "Community table", brandPrimary, logoUrl: "https://private.example/logo.svg", brandIdentity: { secret: "private kit" } }, public_slug: "community-table", updated_at: NOW })
beforeEach(() => { vi.resetAllMocks(); mocks.actor.mockResolvedValue({ actorId: WORKSPACE, orgId: WORKSPACE, supabase: {} }); mocks.page.mockResolvedValue(null); mocks.sources.mockResolvedValue(sources()); mocks.images.mockResolvedValue(new Map()); mocks.upload.mockResolvedValue({ error: null }) })
async function review() { const result = await reviewWorkspacePageAction(request); if (!result.ok) throw new Error(result.error); return result.value }
describe("reviewed organization profile branding", () => {
  it("requires matching logo review before uploading and committing its approved private copy", async () => {
    const source = { id: ID(40), org_id: WORKSPACE, document_kind: null, deleted_at: null, mime_type: "image/png", size_bytes: 4, storage_path: `${WORKSPACE}/library/logo.png`, updated_at: NOW }
    const representation = { bytes: Buffer.from("webp"), sha256: "a".repeat(64), width: 100, height: 50, version: 1 as const, mimeType: "image/webp" as const }
    mocks.images.mockResolvedValue(new Map([["brand-logo", { source, representation }]]))
    const reviewed = await review()
    expect(mocks.images.mock.calls[0][1].profile).toEqual(sources().profile)
    expect(reviewed.snapshot.brand.logo).toMatchObject({ width: 100, height: 50 })
    expect(mocks.upload).not.toHaveBeenCalled()
    representation.sha256 = "b".repeat(64)
    await expect(writeWorkspacePage({ ...request, operationId: ID(11), intent: "publish", reviewToken: reviewed.reviewToken })).rejects.toMatchObject({ code: "conflict" })
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled()
    representation.sha256 = "a".repeat(64)
    mocks.rpc.mockImplementation(async (_name: string, args: Record<string, unknown>) => {
      expect(args.p_image_assets).toEqual([expect.objectContaining({ id: reviewed.snapshot.brand.logo!.assetId, source, sha256: representation.sha256, width: 100, height: 50 })])
      expect(args.p_snapshot).toEqual(reviewed.snapshot)
      return { data: { replayed: false, page: { id: ID(10), org_id: WORKSPACE, link_id: ID(10), title: draft.title, description: "", particle_ids: draft.particleIds, revision: 1, visibility: "public", published_snapshot: JSON.parse(JSON.stringify(args.p_snapshot)), published_at: NOW, created_at: NOW, updated_at: NOW, last_operation_id: ID(11), last_operation_actor: WORKSPACE, last_operation_hash: "a".repeat(64) } }, error: null }
    })
    const saved = await writeWorkspacePage({ ...request, operationId: ID(11), intent: "publish", reviewToken: reviewed.reviewToken })
    expect(saved.page.publishedSnapshot?.brand.logo).toEqual(reviewed.snapshot.brand.logo)
    expect(mocks.upload).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(new RegExp(`^${WORKSPACE}/${ID(10)}/.+\\.webp$`)), representation.bytes, { contentType: "image/webp", cacheControl: "0", upsert: false })
  })
  it("projects only approved logo grant identity and renders its exact audience endpoint", () => {
    const logo = { assetId: ID(40), width: 100, height: 50 }
    const snapshot = projectWorkspacePage({ orgId: WORKSPACE, profile: sources().profile,
      graph: graph(), publicSlug: "community-table", draft, imageIds: new Map([["brand-logo", logo]]) })
    expect(snapshot.brand.logo).toEqual(logo)
    expect(JSON.stringify(snapshot)).not.toContain("private kit")
    expect(JSON.stringify(snapshot)).not.toContain("private.example")
    const html = renderToStaticMarkup(createElement(PublicWorkspacePage, { snapshot, imageAudience: "guest" }))
    expect(html).toContain(`/api/public/workspace-page-assets/${ID(40)}?audience=guest`)
    expect(html).toContain('width="44" height="44"')
    expect(html).not.toContain("/_next/image")
    const preview = renderToStaticMarkup(createElement(PublicWorkspacePage, { snapshot, imagePreviews: { [ID(40)]: "/api/account/workspace-page-image?logo=primary" } }))
    expect(preview).toContain('/api/account/workspace-page-image?logo=primary')
    expect(workspacePageSnapshotSchema.safeParse({ ...snapshot, brand: { ...snapshot.brand, logo: { ...logo, sourceUrl: "https://private.example" } } }).success).toBe(false)
  })
  it("binds canonical logo evidence and bytes to its review identity", () => {
    const image = { source: { id: ID(40), org_id: WORKSPACE, document_kind: null, deleted_at: null, mime_type: "image/png", size_bytes: 4, storage_path: `${WORKSPACE}/library/logo.png`, updated_at: NOW }, representation: { bytes: Buffer.from("webp"), sha256: "a".repeat(64), width: 100, height: 50, version: 1 as const, mimeType: "image/webp" as const } }
    const images = new Map([["brand-logo", image]])
    const first = identifyPageImages(images, ID(10), 1, null)
    const assetId = first.ids.get("brand-logo")!.assetId
    expect(first.previews[assetId]).toContain("logo=primary")
    expect(first.previews[assetId]).not.toContain("particleId")
    image.representation.sha256 = "b".repeat(64)
    expect(identifyPageImages(images, ID(10), 1, null).ids.get("brand-logo")!.assetId).not.toBe(assetId)
  })
  it("publishes only the reviewed color and reads the immutable snapshot after later profile edits", async () => {
    const reviewed = await review()
    expect(reviewed.snapshot.brand).toEqual({ name: "Community table", organizationSlug: "community-table", primaryColor: "#3B82F6" })
    expect(JSON.stringify(reviewed)).not.toContain("private.example"); expect(JSON.stringify(reviewed)).not.toContain("private kit")
    mocks.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      expect(name).toBe("commit_workspace_page")
      expect(args).toMatchObject({ p_expected_org_updated_at: NOW, p_expected_graph: sources().graph })
      return { data: { replayed: false, page: { id: ID(10), org_id: WORKSPACE, link_id: ID(10), title: draft.title, description: "", particle_ids: draft.particleIds, revision: 1, visibility: "public", published_snapshot: JSON.parse(JSON.stringify(args.p_snapshot)), published_at: NOW, created_at: NOW, updated_at: NOW, last_operation_id: ID(11), last_operation_actor: WORKSPACE, last_operation_hash: "a".repeat(64) } }, error: null }
    })
    const saved = await writeWorkspacePage({ ...request, operationId: ID(11), intent: "publish", reviewToken: reviewed.reviewToken })
    mocks.sources.mockResolvedValue(sources("#ff0000")); mocks.sources.mockClear()
    mocks.rpc.mockResolvedValue({ data: { snapshot: saved.page.publishedSnapshot, publishedAt: NOW }, error: null })
    const published = await loadPublicWorkspacePage("community-table", ID(10))
    expect(published?.snapshot.brand.primaryColor).toBe("#3B82F6"); expect(mocks.sources).not.toHaveBeenCalled()
    const html = renderToStaticMarkup(createElement(PublicWorkspacePage, { snapshot: published!.snapshot }))
    expect(html).toContain("background-color:#3B82F6;color:#000000"); expect(html).not.toContain("private.example")
    // Existing closure/public revocation RPC remains authoritative over every snapshot.
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect(await loadPublicWorkspacePage("community-table", ID(12))).toBeNull()
  })
  it("requires a new preview if the saved primary color changes before publish", async () => {
    const reviewed = await review(); mocks.sources.mockResolvedValue(sources("#aabbcc"))
    expect(await commitWorkspacePageAction({ ...request, operationId: ID(11), intent: "publish", reviewToken: reviewed.reviewToken })).toMatchObject({ ok: false, code: "conflict" })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("keeps legacy and invalid profile colors neutral and rejects injected snapshot CSS/assets", async () => {
    for (const value of [null, 12, "url(https://private.example)", "#123456;display:none", ""]) {
      mocks.sources.mockResolvedValue(sources(value)); expect((await review()).snapshot.brand).not.toHaveProperty("primaryColor")
    }
    expect(projectPageBrandColor(" #aBc ")).toBe("#AABBCC")
    const snapshot = (await review()).snapshot
    expect(pageBrandStyle(undefined)).toBeUndefined()
    expect(workspacePageSnapshotSchema.safeParse(snapshot).success).toBe(true)
    expect(workspacePageSnapshotSchema.safeParse({ ...snapshot, brand: { ...snapshot.brand, primaryColor: "red" } }).success).toBe(false)
    expect(workspacePageSnapshotSchema.safeParse({ ...snapshot, brand: { ...snapshot.brand, logoUrl: "https://private.example/logo" } }).success).toBe(false)
  })
  it("keeps initials above4.5:1 contrast across grayscale and saturated colors", () => {
    const colors = Array.from({ length: 256 }, (_, channel) => `#${channel.toString(16).padStart(2, "0").repeat(3)}`)
    for (const r of [0, 51, 102, 153, 204, 255]) for (const g of [0, 51, 102, 153, 204, 255]) for (const b of [0, 51, 102, 153, 204, 255]) colors.push(`#${[r,g,b].map(x => x.toString(16).padStart(2,"0")).join("")}`)
    for (const color of colors) { const style = pageBrandStyle(color)!; expect(contrastRatio(style.color, style.backgroundColor), color).toBeGreaterThanOrEqual(4.5) }
  })
})
