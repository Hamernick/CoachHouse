import { beforeEach, describe, expect, it, vi } from "vitest"
import { canonicalDrivePublicLink } from "@/features/workspace-sharing"
import { resolvePageDriveSources } from "@/features/workspace-sharing/server/page-drive-sources"
import { loadPublicWorkspacePage } from "@/features/workspace-sharing/server/public-page"
import { createLibraryDocumentParticle } from "@/features/workspace-particles/lib/particle-library-document"
import { graph, ID, NOW, WORKSPACE } from "./fixtures/particle-fixtures"
import { createClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/lib/supabase"
import type { PageActor } from "@/features/workspace-sharing/server/page-context"
import { updateRoadmapSection } from "@/lib/roadmap"
import { z } from "zod"

const mocks = vi.hoisted(() => ({ from: vi.fn(), rows: vi.fn(), admin: vi.fn(), rpc: vi.fn(), flags: { publicSharingEnabled: true } }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/lib/feature-flags", () => mocks.flags)
const fileId = "canonicalFile01"
const href = `https://docs.google.com/document/d/${fileId}/edit`
const row = { id: ID(40), provider_file_id: fileId, web_view_link: href, updated_at: NOW }
const actor: PageActor = { actorId: WORKSPACE, orgId: WORKSPACE, supabase: createClient<Database>("https://fixture.invalid", "fixture") }
vi.spyOn(actor.supabase, "from").mockImplementation(mocks.from)
const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), abortSignal: mocks.rows }
// Test actor exposes the exact Supabase query surface used by this resolver.
const resolve = (profile: Json = {}, core = false) => {
  const document = createLibraryDocumentParticle(WORKSPACE, {
    name: "Shared document", mimeType: "application/vnd.google-apps.document",
    source: core ? { kind: "roadmap_drive", sectionId: "vision", fileId, webViewLink: href }
      : { kind: "drive", id: ID(40), webViewLink: href },
  }, ID(1), NOW)
  return { graph: graph([document]), profile, draft: { title: "", description: "", particleIds: [ID(1)] } }
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.flags.publicSharingEnabled = true
  mocks.from.mockReturnValue(query)
  mocks.rows.mockResolvedValue({ data: [row], error: null })
  mocks.admin.mockReturnValue({ rpc: mocks.rpc })
  mocks.rpc.mockResolvedValue({ data: null, error: null })
})

describe("canonical public Drive links", () => {
  it("retains a single resource key while stripping account/token/query/fragment data", () => {
    expect(canonicalDrivePublicLink(`${href}?authuser=0&access_token=private&resourcekey=0-safe#private`, fileId))
      .toBe(`${href}?resourcekey=0-safe`)
  })
  it("normalizes file and open links without changing provider identity", () => {
    expect(canonicalDrivePublicLink(`https://drive.google.com/open?id=${fileId}&usp=sharing`, fileId))
      .toBe(`https://drive.google.com/file/d/${fileId}/view`)
    expect(canonicalDrivePublicLink(`https://drive.google.com/file/d/${fileId}/preview`, fileId))
      .toBe(`https://drive.google.com/file/d/${fileId}/view`)
  })
  it.each([
    "http://drive.google.com/file/d/canonicalFile01/view", "https://drive.google.com.evil.test/file/d/canonicalFile01/view",
    "https://user:password@drive.google.com/file/d/canonicalFile01/view", "https://drive.google.com:444/file/d/canonicalFile01/view",
    "https://drive.google.com/drive/folders/canonicalFile01", "https://docs.google.com/document/d/e/canonicalFile01/pub",
    "https://docs.google.com/redirect?url=https://evil.test", "https://docs.google.com/file/d/canonicalFile01/view",
    "https://drive.google.com/file/d/short/view", `${href}?resourcekey=a&resourcekey=b`, `${href}?resourcekey=a%20b`,
  ])("rejects unsafe or unsupported link %s", (value) => {
    expect(canonicalDrivePublicLink(value, fileId)).toBeNull()
  })
  it("rejects a provider identity mismatch", () => {
    expect(canonicalDrivePublicLink(href, "anotherFile01")).toBeNull()
  })
})

describe("page Drive source authorization", () => {
  it("batches only selected same-organization available attachments with actor RLS", async () => {
    const input = resolve()
    const result = await resolvePageDriveSources(actor, input)
    expect(result.links.get(ID(1))).toBe(href)
    expect(result.checks).toEqual([row])
    expect(mocks.from).toHaveBeenCalledOnce()
    expect(query.eq).toHaveBeenCalledWith("org_id", WORKSPACE)
    expect(query.eq).toHaveBeenCalledWith("status", "available")
    expect(query.in).toHaveBeenCalledWith("id", [ID(40)])
  })
  it("does no source query for intrinsic records or unselected Drive cards", async () => {
    const input = resolve()
    input.draft.particleIds = [ID(2)]
    expect((await resolvePageDriveSources(actor, input)).links.size).toBe(0)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it.each([{ data: [] }, { data: [{ ...row, web_view_link: `${href}?changed=1` }] }, { data: [{ ...row, provider_file_id: "anotherFile01" }] }])(
    "rejects inaccessible, changed or mismatched canonical sources", async ({ data }) => {
      mocks.rows.mockResolvedValue({ data, error: null })
      await expect(resolvePageDriveSources(actor, resolve())).rejects.toThrow("changed or is unavailable")
    })
  it("does not publish a source after a metadata query failure", async () => {
    mocks.rows.mockResolvedValue({ data: null, error: { message: "private error" } })
    await expect(resolvePageDriveSources(actor, resolve())).rejects.toThrow("Unable to verify")
  })
  it("rejects a stale Core Document Drive reference without querying another table", async () => {
    await expect(resolvePageDriveSources(actor, resolve({}, true))).rejects.toThrow("changed or is unavailable")
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it("resolves a Core Document from its canonical profile and requires that profile at commit", async () => {
    const linked = updateRoadmapSection({}, "vision", { driveSource: {
      provider: "google_drive", fileId, name: "Shared document", webViewLink: href,
    } })
    const profile = z.json().parse(JSON.parse(JSON.stringify(linked.nextProfile)))
    const result = await resolvePageDriveSources(actor, resolve(profile, true))
    expect(result.links.get(ID(1))).toBe(href)
    expect(result.expectedProfile).toEqual(profile)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

const publication = () => ({
  snapshot: { version: 1, brand: { name: "Community table", organizationSlug: "community-table" }, title: "Welcome", description: "",
    items: [{ id: ID(1), title: "Document", content: { kind: "drive_link", href } }] },
  publishedAt: NOW,
})
describe("public snapshot read boundary", () => {
  it("uses one bounded lookup and returns only validated committed content", async () => {
    mocks.rpc.mockResolvedValue({ data: publication(), error: null })
    expect(await loadPublicWorkspacePage("community-table", ID(10))).toEqual(publication())
    expect(mocks.rpc).toHaveBeenCalledWith("read_workspace_page_public", { p_organization_slug: "community-table", p_link_id: ID(10) })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it("returns unavailable for a private, missing or revoked page", async () => {
    expect(await loadPublicWorkspacePage("community-table", ID(10))).toBeNull()
  })
  it.each([["../private", ID(10)], ["community-table", "not-a-link"]])("rejects malformed addresses before creating a privileged client", async (slug, id) => {
    expect(await loadPublicWorkspacePage(slug, id)).toBeNull()
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("respects the publication feature gate", async () => {
    mocks.flags.publicSharingEnabled = false
    expect(await loadPublicWorkspacePage("community-table", ID(10))).toBeNull()
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("rejects private extra fields in stored public content", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...publication(), draft: { private: true } }, error: null })
    expect(await loadPublicWorkspacePage("community-table", ID(10))).toBeNull()
  })
  it("rejects ungranted asset IDs, unsafe URLs and mismatched brands", async () => {
    for (const content of [{ kind: "image", assetId: ID(40), alt: "" }, { kind: "document", assetId: ID(40), name: "Private.pdf" },
      { kind: "drive_link", href: "https://docs.google.com/redirect?url=private" }]) {
      const page = publication()
      mocks.rpc.mockResolvedValue({ data: { ...page, snapshot: { ...page.snapshot, items: [{ id: ID(1), title: "File", content }] } }, error: null })
      expect(await loadPublicWorkspacePage("community-table", ID(10))).toBeNull()
    }
    mocks.rpc.mockResolvedValue({ data: publication(), error: null })
    expect(await loadPublicWorkspacePage("another-org", ID(10))).toBeNull()
  })
  it("reports an outage rather than serving stale public content", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private database details" } })
    await expect(loadPublicWorkspacePage("community-table", ID(10))).rejects.toThrow("temporarily unavailable")
  })
})
