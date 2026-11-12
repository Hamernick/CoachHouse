import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchPublicPreviewHtml, type LinkedInImageRefreshDependencies } from "@/lib/people/linkedin-image-refresh"
import { parsePublicPageMetadata } from "@/lib/editor/public-page-metadata"
import { opportunityProfileSources } from "@/features/workspace-finance/server/opportunity-profile-sources"
const actions = vi.hoisted(() => ({ context: vi.fn(), options: vi.fn(), copies: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: actions.copies }) }))
beforeEach(() => actions.copies.mockReset().mockResolvedValue({ data: { blockedSectionIds: [], complete: false }, error: null }))
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
  it("builds person and document references without persisting contents or signing downloads", async () => {
    const sources = await opportunityProfileSources({ org_people: [{ id: "00000000-0000-4000-8000-000000000001", name: "Person", title: "Director" }], documents: { bylaws: { path: "organization/bylaws/file.pdf" } } }, WORKSPACE, ID(6))
    expect(sources.find(item => item.category === "Person")).toMatchObject({ title: "Person", source: { kind: "person", id: "00000000-0000-4000-8000-000000000001" } })
    expect(sources.find(item => item.title === "Bylaws")?.source).toEqual({ kind: "document", id: "upload:bylaws" })
  })
})

import { opportunityDocumentDrop } from "@/features/workspace-finance/lib/opportunity-document-drop"
import { createLibraryDocumentParticle, type ParticleLibraryDocument } from "@/features/workspace-particles/lib/particle-library-document"
import { ID, NOW, WORKSPACE } from "./fixtures/particle-fixtures"
import { opportunitySourceSchema, type OpportunitySourceOption } from "@/features/workspace-finance/lib/opportunity-sources"

describe("opportunity document attachments", () => {
  const request = (document: ParticleLibraryDocument) => ({ kind: "preset" as const, particle: createLibraryDocumentParticle(WORKSPACE, document, ID(1), NOW) })
  it("links library uploads by file id and rejects another organization", () => {
    const item = request({ name: "Brief.pdf", mimeType: "application/pdf", fileId: ID(2) })
    expect(opportunityDocumentDrop(item, WORKSPACE, [])).toEqual({ kind: "file", id: ID(2) })
    expect(opportunityDocumentDrop(item, ID(3), [])).toBeNull()
    expect(opportunitySourceSchema.safeParse({ kind: "file", id: ID(2) }).success).toBe(true)
    expect(opportunitySourceSchema.safeParse({ kind: "file", id: "../private" }).success).toBe(false)
  })
  it("links original core documents, policies, and Drive resources", () => {
    const base = { name: "Document", mimeType: "application/pdf" }
    expect(opportunityDocumentDrop(request({ ...base, source: { kind: "upload", documentKind: "bylaws" } }), WORKSPACE, [])).toEqual({ kind: "document", id: "upload:bylaws" })
    expect(opportunityDocumentDrop(request({ ...base, source: { kind: "policy", id: ID(4) } }), WORKSPACE, [])).toEqual({ kind: "document", id: `policy:${ID(4)}` })
    expect(opportunityDocumentDrop(request({ ...base, source: { kind: "roadmap", sectionId: "vision" } }), WORKSPACE, [])).toEqual({ kind: "document", id: "roadmap:vision" })
    expect(opportunityDocumentDrop(request({ ...base, source: { kind: "drive", id: "drive-file", webViewLink: "https://docs.google.com/document/d/drive-file/edit" } }), WORKSPACE, [])).toEqual({ kind: "link", url: "https://docs.google.com/document/d/drive-file/edit" })
  })
  it("requires an authorized personal-note reference and preserves existing workspace notes", () => {
    const item = request({ name: "Module notes", mimeType: "text/plain", source: { kind: "module_note", moduleId: ID(5) } })
    const option: OpportunitySourceOption = { source: { kind: "document", id: `module:${ID(6)}:${ID(5)}` }, title: "Notes", category: "Document" }
    expect(opportunityDocumentDrop(item, WORKSPACE, [])).toBeNull()
    expect(opportunityDocumentDrop(item, WORKSPACE, [option])).toEqual(option.source)
    expect(opportunityDocumentDrop({ kind: "existing", drag: { kind: "particle", workspaceId: WORKSPACE, id: ID(7) } }, WORKSPACE, [])).toEqual({ kind: "particle", id: ID(7) })
  })
})

const driveSource = { provider: "google_drive", fileId: "drive-document-123", name: "Drive source", webViewLink: "https://docs.google.com/document/d/drive-document-123/edit" }
it.each([
  ["legacy editor", {}, true, "Editor body"],
  ["explicit editor with retained Drive", { documentSource: "editor", driveSource }, true, "Editor body"],
  ["legacy Drive", { driveSource }, true, undefined],
  ["explicit Drive", { documentSource: "google_drive", driveSource }, true, undefined],
  ["missing Drive", { documentSource: "google_drive" }, false, undefined],
  ["invalid Drive", { documentSource: "google_drive", driveSource: { ...driveSource, webViewLink: "https://example.com/private" } }, false, undefined],
] as const)("funding context respects %s without disclosing an inactive body", async (_name, source, available, description) => {
  const profile = { roadmap: { sections: [{ id: "vision", title: "Vision", content: "Editor body", ...source }] } }
  const before = JSON.stringify(profile)
  const option = (await opportunityProfileSources(profile, WORKSPACE, ID(6))).find(item => item.source.kind === "document" && item.source.id === "roadmap:vision")
  expect(Boolean(option)).toBe(available)
  expect(option?.description).toBe(description)
  expect(JSON.stringify(profile)).toBe(before)
})


it("checks only active editor funding sources and withholds blocked names and snippets on every read", async () => {
  const profile = { roadmap: { sections: [
    { id: "vision", title: "Secret title", content: "Secret body", documentSource: "editor" },
    { id: "mission", title: "Drive title", content: "Inactive body", documentSource: "google_drive", driveSource },
  ] } }
  const original = structuredClone(profile)
  actions.copies.mockResolvedValue({ data: { blockedSectionIds: ["vision"], complete: false }, error: null })
  const sources = await opportunityProfileSources(profile, WORKSPACE, ID(6))
  expect(sources.map(item => item.source)).toContainEqual({ kind: "document", id: "roadmap:mission" })
  expect(JSON.stringify(sources)).not.toMatch(/Secret|Inactive body/)
  expect(actions.copies).toHaveBeenLastCalledWith("read_workspace_ai_document_copy_sources", { p_org_id: WORKSPACE, p_actor_id: ID(6), p_section_ids: ["vision"] })
  expect(profile).toEqual(original)
  actions.copies.mockResolvedValue({ data: { blockedSectionIds: [], complete: false }, error: null })
  expect((await opportunityProfileSources(profile, WORKSPACE, ID(6))).find(item => item.title === "Secret title")?.description).toBe("Secret body")
  actions.copies.mockResolvedValue({ data: null, error: { message: "Private detail" } })
  await expect(opportunityProfileSources(profile, WORKSPACE, ID(6))).rejects.toThrow("sources could not be verified")
})
