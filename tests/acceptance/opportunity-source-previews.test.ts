import { describe, expect, it, vi } from "vitest"
import { fetchPublicPreviewHtml, type LinkedInImageRefreshDependencies } from "@/lib/people/linkedin-image-refresh"
import { parsePublicPageMetadata } from "@/lib/editor/public-page-metadata"
import { opportunityProfileSources } from "@/features/workspace-finance/server/opportunity-profile-sources"
const actions = vi.hoisted(() => ({ context: vi.fn(), options: vi.fn() }))
vi.mock("@/lib/auth/request-context", () => ({ resolveAuthenticatedAppContext: actions.context }))
vi.mock("@/features/workspace-finance/server", () => ({ loadOpportunitySourceOptions: actions.options }))
import { getWorkspaceOpportunitySources, previewOpportunityLink } from "@/actions/workspace-opportunity-sources"

function dependencies(body: string, location?: string): LinkedInImageRefreshDependencies {
  return {
    resolveAddresses: async () => [{ address: "93.184.216.34", family: 4 }],
    request: vi.fn(async url => ({ url, status: location ? 302 : 200, discard: vi.fn(), headers: { "content-type": "text/html", ...(location ? { location } : {}) }, body: (async function* () { yield Buffer.from(body) })() })),
  }
}
describe("opportunity source previews", () => {
  it("rejects cross-organization source and link preview requests", async () => {
    actions.context.mockResolvedValue({ activeOrg: { orgId: "00000000-0000-4000-8000-000000000001" }, user: { id: "viewer" }, supabase: {} })
    const other = "00000000-0000-4000-8000-000000000002"
    expect(await getWorkspaceOpportunitySources(other)).toHaveProperty("error")
    expect(await previewOpportunityLink(other, "https://example.org")).toHaveProperty("error")
    expect(actions.options).not.toHaveBeenCalled()
  })
  it("requires authentication before source discovery", async () => {
    actions.context.mockRejectedValueOnce(new Error("signed out"))
    expect(await getWorkspaceOpportunitySources("00000000-0000-4000-8000-000000000001")).toHaveProperty("error")
    expect(actions.options).not.toHaveBeenCalled()
  })
  it("reads metadata as bounded plain text regardless of attribute order", () => {
    expect(parsePublicPageMetadata('<meta content="A &amp; B" property="og:title"><meta name="description" content="<b>Useful</b> resource"><title>Fallback</title>')).toMatchObject({ title: "A & B", description: "Useful resource" })
    expect(parsePublicPageMetadata(`<title>${"a".repeat(500)}</title>`).title).toHaveLength(240)
  })
  it("denies private hosts, credentials and nonstandard ports before requesting", async () => {
    for (const url of ["http://127.0.0.1/", "http://[::1]/", "https://localhost/", "https://user:pass@example.org/", "https://example.org:9999/"]) {
      const deps = dependencies("")
      await expect(fetchPublicPreviewHtml(url, deps)).rejects.toThrow()
      expect(deps.request).not.toHaveBeenCalled()
    }
  })
  it("revalidates redirects and bounds HTML responses", async () => {
    await expect(fetchPublicPreviewHtml("https://example.org", dependencies("", "http://169.254.169.254/"))).rejects.toThrow()
    await expect(fetchPublicPreviewHtml("https://example.org", dependencies("x".repeat(256 * 1024 + 1)))).rejects.toThrow("byte limit")
    expect(await fetchPublicPreviewHtml("https://example.org", dependencies("<title>Example</title>"))).toContain("Example")
  })
  it("builds person and document references without persisting contents or signing downloads", () => {
    const sources = opportunityProfileSources({ org_people: [{ id: "00000000-0000-4000-8000-000000000001", name: "Person", title: "Director" }], documents: { bylaws: { path: "organization/bylaws/file.pdf" } } })
    expect(sources.find(item => item.category === "Person")).toMatchObject({ title: "Person", source: { kind: "person", id: "00000000-0000-4000-8000-000000000001" } })
    expect(sources.find(item => item.title === "Bylaws")?.source).toEqual({ kind: "document", id: "upload:bylaws" })
  })
})
