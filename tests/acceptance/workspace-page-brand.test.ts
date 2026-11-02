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
import { graph, ID, NOW, WORKSPACE } from "./fixtures/particle-fixtures"
const mocks = vi.hoisted(() => ({ actor: vi.fn(), page: vi.fn(), sources: vi.fn(), rpc: vi.fn() }))
vi.mock("@/features/workspace-sharing/server/page-context", async () => ({ ...await vi.importActual<typeof import("@/features/workspace-sharing/server/page-context")>("@/features/workspace-sharing/server/page-context"), loadPageActor: mocks.actor, loadSavedPage: mocks.page, loadSavedPageSources: mocks.sources }))
vi.mock("@/features/workspace-sharing/server/page-asset-sources", () => ({ resolvePageImageSources: async () => new Map() }))
vi.mock("@/features/workspace-sharing/server/page-document-sources", () => ({ resolvePageDocumentSources: async () => new Map() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("@/lib/feature-flags", () => ({ publicSharingEnabled: true }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
const draft = { title: "Reviewed page", description: "", particleIds: [ID(1)] }
const request = { pageId: ID(10), expectedRevision: 0, draft }
const sources = (brandPrimary: unknown = "#3b82f6") => ({ graph: graph(), profile: { name: "Community table", brandPrimary, logoUrl: "https://private.example/logo.svg", brandIdentity: { secret: "private kit" } }, public_slug: "community-table", updated_at: NOW })
beforeEach(() => { vi.resetAllMocks(); mocks.actor.mockResolvedValue({ actorId: WORKSPACE, orgId: WORKSPACE, supabase: {} }); mocks.page.mockResolvedValue(null); mocks.sources.mockResolvedValue(sources()) })
async function review() { const result = await reviewWorkspacePageAction(request); if (!result.ok) throw new Error(result.error); return result.value }
describe("reviewed organization profile branding", () => {
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
