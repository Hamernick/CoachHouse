import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"

const ROOT = process.cwd()

function readSource(path: string) {
  return readFileSync(join(ROOT, path), "utf8")
}

describe("organization profile read safety", () => {
  const workspaceProfileLoader = readSource(
    "src/app/(dashboard)/my-organization/_lib/my-organization-page-profile.ts",
  )
  const roadmapPage = readSource(
    "src/components/roadmap/strategic-roadmap-editor-page.tsx",
  )

  it("never writes the organization profile while rendering a page", () => {
    for (const source of [workspaceProfileLoader, roadmapPage]) {
      expect(source).not.toContain('.upsert(')
      expect(source).not.toContain('.update(')
      expect(source).not.toContain('.insert(')
    }
  })

  it("still normalizes legacy profile content in memory", () => {
    expect(workspaceProfileLoader).toContain(
      "cleanupOrgProfileHtml(orgRow?.profile ?? {}).nextProfile",
    )
    expect(roadmapPage).toContain(
      "cleanupOrgProfileHtml(orgRow?.profile ?? {})",
    )
    expect(roadmapPage).toContain(
      "cleanupRoadmapTestSections(htmlCleanup.nextProfile).nextProfile",
    )
  })
})


const reader = vi.hoisted(() => ({
  rpc: vi.fn(), serverClient: vi.fn(), capabilities: vi.fn(), homework: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: reader.rpc }) }))
vi.mock("@/lib/supabase", () => ({ createSupabaseServerClient: reader.serverClient }))
vi.mock("@/lib/organization/active-org", () => ({ resolveActiveOrganization: async () => ({ orgId: "org-1", role: "owner" }), canEditOrganization: () => true }))
vi.mock("@/lib/organization/document-capabilities", () => ({ resolveDocumentCapabilities: reader.capabilities }))
vi.mock("@/lib/roadmap/homework", () => ({ resolveRoadmapHomework: reader.homework }))
vi.mock("@/components/roadmap/roadmap-shell", () => ({
  RoadmapShell: (props: unknown) => createElement("pre", null, JSON.stringify(props)),
}))
vi.mock("@/components/paywall/feature-upgrade-notice", () => ({ FeatureUpgradeNotice: () => null }))

describe("ordinary roadmap editor source access", () => {
  const profile = {
    mission: "Unchanged legacy narrative",
    roadmap: { sections: [
      { id: "vision", title: "Private title", content: "<p>Private body</p>", publishedContent: "Private publication", lastUpdated: "2026-11-06T00:00:00.000Z" },
      { id: "values", title: "Readable title", content: "<p>Readable body</p>" },
    ] },
  }
  beforeEach(() => {
    vi.clearAllMocks()
    reader.rpc.mockResolvedValue({ data: { blockedSectionIds: ["vision"], complete: false }, error: null })
    reader.capabilities.mockResolvedValue({ capabilities: { canView: true, canEdit: false, reason: "viewer" } })
    reader.homework.mockResolvedValue({ vision: { answers: "Private homework" }, values: null })
    reader.serverClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "reader-1" } }, error: null }) },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { profile, public_slug: "example" }, error: null }) }) }) }),
    })
  })

  it("withholds blocked sections and their metadata from client props without rewriting the canonical profile", async () => {
    const before = JSON.stringify(profile)
    const { StrategicRoadmapEditorPage } = await import("@/components/roadmap/strategic-roadmap-editor-page")
    const html = renderToStaticMarkup(await StrategicRoadmapEditorPage({ redirectTo: "/roadmap", initialSectionSlug: "vision" }))
    expect(html).toContain("Readable body")
    expect(html).not.toMatch(/Private body|Private title|Private publication|Private homework/)
    expect(html).toContain("&quot;initialSectionId&quot;:null")
    expect(html).toContain("&quot;canEdit&quot;:false")
    expect(reader.rpc).toHaveBeenCalledWith("read_workspace_ai_document_copy_sources", {
      p_org_id: "org-1", p_actor_id: "reader-1", p_section_ids: expect.arrayContaining(["vision", "values"]),
    })
    expect(JSON.stringify(profile)).toBe(before)
  })

  it("rechecks on reopening and restores the original section after access returns", async () => {
    const { StrategicRoadmapEditorPage } = await import("@/components/roadmap/strategic-roadmap-editor-page")
    const closed = renderToStaticMarkup(await StrategicRoadmapEditorPage({ redirectTo: "/roadmap" }))
    expect(closed).not.toContain("Private body")
    reader.rpc.mockResolvedValue({ data: { blockedSectionIds: [], complete: false }, error: null })
    const reopened = renderToStaticMarkup(await StrategicRoadmapEditorPage({ redirectTo: "/roadmap", initialSectionSlug: "vision" }))
    expect(reopened).toContain("Private body")
    expect(reopened).toContain("&quot;initialSectionId&quot;:&quot;vision&quot;")
    expect(reader.rpc).toHaveBeenCalledTimes(2)
  })

  it("fails closed on verification outage before returning client content", async () => {
    reader.rpc.mockResolvedValue({ data: null, error: { message: "private database details" } })
    const { StrategicRoadmapEditorPage } = await import("@/components/roadmap/strategic-roadmap-editor-page")
    await expect(StrategicRoadmapEditorPage({ redirectTo: "/roadmap" })).rejects.toThrow("Document sources could not be verified.")
  })

  it("keeps document authorization ahead of retained-source access", async () => {
    reader.capabilities.mockResolvedValue({ error: "Forbidden" })
    const { StrategicRoadmapEditorPage } = await import("@/components/roadmap/strategic-roadmap-editor-page")
    await expect(StrategicRoadmapEditorPage({ redirectTo: "/roadmap" })).rejects.toThrow("Unable to verify document access.")
    expect(reader.rpc).not.toHaveBeenCalled()
  })
})


vi.mock("@/lib/organization/brand-identity-persistence", () => ({ loadOrganizationBrandIdentity: async () => null }))
vi.mock("@/lib/accelerator/entitlements", () => ({ fetchLearningEntitlements: async () => ({ hasAcceleratorAccess: true }) }))
vi.mock("@/lib/modules/notes-index", () => ({ listUserModuleNotesIndex: async () => [] }))
vi.mock("@/components/organization/org-profile-card/tabs/documents-tab", () => ({
  DocumentsTab: (props: unknown) => createElement("pre", null, JSON.stringify(props)),
}))

describe("workspace profile and document projections", () => {
  const privateSections = [
    { id: "vision", title: "Restricted title", content: "Restricted body", publishedContent: "Restricted publication" },
    { id: "need", content: "Restricted need" },
    { id: "origin_story", content: "Restricted origin" },
    { id: "theory_of_change", content: "Restricted theory" },
    { id: "mission_vision_values", content: "Restricted mission" },
    { id: "values", content: "Restricted values" },
    { id: "custom-private", title: "Restricted custom", content: "Restricted custom body" },
  ]
  const profile = {
    name: "Team organization", programs: "Unchanged programs",
    vision: "Restricted legacy vision", mission: "Restricted legacy mission", values: ["Restricted legacy values"],
    need: "Restricted legacy need", needStatement: "Restricted alternate need", need_statement: "Restricted snake need",
    originStory: "Restricted origin alias", origin_story: "Restricted origin snake",
    theoryOfChange: "Restricted theory alias", theory_of_change: "Restricted theory snake",
    roadmap: { heroUrl: "https://example.org/hero.png", sections: [
      ...privateSections, { id: "readable-custom", title: "Readable title", content: "Readable body" },
    ] },
  }
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "reader-1" } }, error: null }) },
    from: (table: string) => ({
      select() { return this }, eq() { return this }, order() { return this },
      returns: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: table === "organizations" ? { profile, public_slug: "example", ein: null, is_public: false } : { role: "member" }, error: null }),
    }),
  }
  beforeEach(() => {
    vi.clearAllMocks()
    reader.rpc.mockResolvedValue({ data: { blockedSectionIds: privateSections.map(section => section.id), complete: false }, error: null })
    reader.serverClient.mockResolvedValue(client)
  })

  it.each(["array", "record"])("removes blocked sections and every known core-document alias from %s storage without changing canonical data", async shape => {
    const { projectReadableDocumentProfile } = await import("@/lib/organization/document-ai-copies")
    const { resolveOrganizationCoreDocuments } = await import("@/lib/roadmap/organization-core-documents")
    const { resolveOrganizationNarratives } = await import("@/lib/roadmap/organization-narratives")
    const source = shape === "array" ? profile : { ...profile, roadmap: { sections: Object.fromEntries(privateSections.slice(0, 6).map(section => [section.id, section])) } }
    if (shape === "record") reader.rpc.mockResolvedValue({ data: { blockedSectionIds: privateSections.slice(0, 6).map(section => section.id), complete: false }, error: null })
    const before = JSON.stringify(source)
    const projection = await projectReadableDocumentProfile(source, "org-1", "reader-1")
    expect(JSON.stringify(projection)).not.toContain("Restricted")
    expect(Object.values(resolveOrganizationCoreDocuments(projection.profile))).toEqual(["", "", "", "", "", ""])
    expect(resolveOrganizationNarratives(projection.profile)).toEqual({ mission: "", vision: "", values: "" })
    expect(projection.profile.programs).toBe("Unchanged programs")
    expect(JSON.stringify(source)).toBe(before)
  })

  it("protects all workspace profile return values and excludes unreadable documents from unrelated profile saves", async () => {
    const { loadMyOrganizationProfileContext } = await import("@/app/(dashboard)/my-organization/_lib/my-organization-page-profile")
    const { prepareOrgProfileSave } = await import("@/components/organization/org-profile-card/hooks/use-org-profile-editor-state-helpers")
    const result = await loadMyOrganizationProfileContext({ orgId: "org-1", actorId: "reader-1", supabase: client as never })
    expect(JSON.stringify(result)).not.toContain("Restricted")
    expect(JSON.stringify(result)).toContain("Readable body")
    const patch = prepareOrgProfileSave({ ...result.initialProfile, name: "Renamed organization" }, result.initialProfile)
    for (const key of ["mission", "vision", "values", "need", "originStory", "theoryOfChange"]) expect(patch).not.toHaveProperty(key)
    expect(patch.coreDocumentPublication).toEqual({})
    expect(patch.name).toBe("Renamed organization")
    expect(reader.rpc).toHaveBeenCalledWith("read_workspace_ai_document_copy_sources", expect.objectContaining({ p_org_id: "org-1", p_actor_id: "reader-1" }))
  })

  it("rechecks workspace access on reload and restores the unchanged source after access returns", async () => {
    const { loadMyOrganizationProfileContext } = await import("@/app/(dashboard)/my-organization/_lib/my-organization-page-profile")
    const input = { orgId: "org-1", actorId: "reader-1", supabase: client as never }
    expect(JSON.stringify(await loadMyOrganizationProfileContext(input))).not.toContain("Restricted")
    reader.rpc.mockResolvedValue({ data: { blockedSectionIds: [], complete: false }, error: null })
    expect(JSON.stringify(await loadMyOrganizationProfileContext(input))).toContain("Restricted body")
    expect(reader.rpc).toHaveBeenCalledTimes(2)
  })

  it("filters organization Documents client props and fails closed when verification is unavailable", async () => {
    const { default: DocumentsPage } = await import("@/app/(dashboard)/organization/documents/organization-documents-page-content")
    const html = renderToStaticMarkup(await DocumentsPage({}))
    expect(html).not.toContain("Restricted")
    expect(html).toContain("Readable body")
    reader.rpc.mockResolvedValue({ data: null, error: { message: "private failure" } })
    await expect(DocumentsPage({})).rejects.toThrow("Document sources could not be verified.")
    const { loadMyOrganizationProfileContext } = await import("@/app/(dashboard)/my-organization/_lib/my-organization-page-profile")
    await expect(loadMyOrganizationProfileContext({ orgId: "org-1", actorId: "reader-1", supabase: client as never })).rejects.toThrow("Document sources could not be verified.")
  })
})


describe("mixed document audience profile fallback", () => {
  const denial = { code: "42501", message: "Document audience projection required." }
  const row = {
    user_id: "org-1", updated_at: "2026-11-07T12:00:00Z", ein: null,
    public_slug: "example", is_public: false, location_lat: null, location_lng: null,
    profile: { name: "Still accessible", mission: "Restricted alias", roadmap: { sections: [
      { id: "mission_vision_values", title: "Restricted title", content: "Restricted body" },
      { id: "readable", title: "Allowed document", content: "Allowed body" },
    ] } },
  }
  const client = (result: unknown) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => result }) }) }) })
  beforeEach(() => {
    vi.clearAllMocks()
    reader.rpc.mockImplementation(async (name: string) => name === "read_organization_profile_for_projection"
      ? { data: row, error: null }
      : { data: { blockedSectionIds: ["mission_vision_values"], complete: false }, error: null })
  })
  it("keeps the workspace and readable document usable after raw-profile denial, without exposing restricted aliases or metadata", async () => {
    const { loadMyOrganizationProfileContext } = await import("@/app/(dashboard)/my-organization/_lib/my-organization-page-profile")
    const before = JSON.stringify(row)
    const result = await loadMyOrganizationProfileContext({ orgId: "org-1", actorId: "reader-1", supabase: client({ data: null, error: denial }) as never })
    expect(JSON.stringify(result)).toContain("Still accessible")
    expect(JSON.stringify(result)).toContain("Allowed body")
    expect(JSON.stringify(result)).not.toContain("Restricted")
    expect(JSON.stringify(row)).toBe(before)
    expect(reader.rpc).toHaveBeenCalledWith("read_organization_profile_for_projection", { p_org_id: "org-1", p_actor_id: "reader-1" })
    expect(reader.rpc).toHaveBeenCalledTimes(2)
  })
  it("renders the ordinary editor with only readable sections after the same denial", async () => {
    reader.serverClient.mockResolvedValue({ ...client({ data: null, error: denial }), auth: { getUser: async () => ({ data: { user: { id: "reader-1" } }, error: null }) } })
    reader.capabilities.mockResolvedValue({ capabilities: { canView: true, canEdit: false, reason: "viewer" } })
    reader.homework.mockResolvedValue({})
    const { StrategicRoadmapEditorPage } = await import("@/components/roadmap/strategic-roadmap-editor-page")
    const html = renderToStaticMarkup(await StrategicRoadmapEditorPage({ redirectTo: "/roadmap" }))
    expect(html).toContain("Allowed body")
    expect(html).not.toContain("Restricted")
  })
  it.each([
    { data: null, error: null },
    { data: null, error: { code: "42501", message: "Different denial" } },
    { data: null, error: { code: "57014", message: "Document audience projection required." } },
    { data: null, error: { code: "503", message: "Database unavailable" } },
  ])("does not elevate missing, failed, or differently denied reads: %j", async result => {
    const { readOrganizationProfileForProjection } = await import("@/lib/organization/profile-read")
    expect(await readOrganizationProfileForProjection(client(result) as never, "org-1", "reader-1")).toEqual(result)
    expect(reader.rpc).not.toHaveBeenCalled()
  })
  it.each([null, { ...row, user_id: "other-org" }, { ...row, profile: [] }, { ...row, updated_at: null }])("rejects malformed or wrong-organization canonical input: %j", async data => {
    reader.rpc.mockResolvedValue({ data, error: null })
    const { readOrganizationProfileForProjection } = await import("@/lib/organization/profile-read")
    expect(await readOrganizationProfileForProjection(client({ data: null, error: denial }) as never, "org-1", "reader-1")).toEqual({ data: null, error: denial })
  })
  it("preserves revoked-parent failure and retries only when a new read is requested", async () => {
    const { readOrganizationProfileForProjection } = await import("@/lib/organization/profile-read")
    const revoked = { code: "42501", message: "Organization projection access required." }
    reader.rpc.mockResolvedValue({ data: null, error: revoked })
    expect(await readOrganizationProfileForProjection(client({ data: null, error: denial }) as never, "org-1", "reader-1")).toEqual({ data: null, error: revoked })
    expect(reader.rpc).toHaveBeenCalledTimes(1)
    reader.rpc.mockResolvedValue({ data: row, error: null })
    expect((await readOrganizationProfileForProjection(client({ data: null, error: denial }) as never, "org-1", "reader-1")).data).toEqual(row)
  })
})
