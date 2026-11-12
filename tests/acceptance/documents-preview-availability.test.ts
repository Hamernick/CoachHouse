import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { buildDocumentsTabDocuments } from "@/components/organization/org-profile-card/tabs/documents-tab/data"
import { buildUploadRows } from "@/components/organization/org-profile-card/tabs/documents-tab/hooks/use-documents-index-row-builders"
import { buildLibraryItems, isEmptyDocumentSlot } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-items"
import { DOCUMENTS } from "@/components/organization/org-profile-card/tabs/documents-tab/constants"

describe("document preview availability", () => {
  it("keeps all seeded document slots missing without creating preview requests", () => {
    const profile = {
      documents: Object.fromEntries(DOCUMENTS.map(({ key, kind }) => [key, {
        name: `${kind}.pdf`, path: `seed/${kind}.pdf`, mime: "application/pdf",
      }])),
    }
    const snapshot = JSON.stringify(profile)
    const documents = buildDocumentsTabDocuments(profile)
    const rows = buildUploadRows(documents)
    expect(rows).toHaveLength(14)
    expect(rows.every((row) => row.status === "missing" && row.document === null)).toBe(true)
    expect(buildLibraryItems(rows, [], [])).toEqual([])
    const slots = buildLibraryItems(rows, [], [], true)
    expect(slots).toHaveLength(14)
    expect(slots.every((item) => !item.previewPath && isEmptyDocumentSlot(item))).toBe(true)
    expect(JSON.stringify(profile)).toBe(snapshot)
  })

  it("preserves a real uploaded document and its preview", () => {
    const document = {
      name: "W9.pdf", path: "org-id/w9/123-W9.pdf", mime: "application/pdf",
      size: 100, updatedAt: "2026-10-19T15:00:00Z",
    }
    const documents = buildDocumentsTabDocuments({ documents: { w9: document } })
    expect(documents.w9).toEqual(document)
    const [item] = buildLibraryItems(buildUploadRows(documents), [], [])
    expect(item.previewPath).toBe("/api/account/org-documents?kind=w9")
    expect(isEmptyDocumentSlot(item)).toBe(false)
  })

  it.each([null, {}, { path: "" }, { path: "  " }, { path: 123 }])(
    "does not turn malformed metadata into a preview: %j", (w9) => {
      expect(buildDocumentsTabDocuments({ documents: { w9 } }).w9).toBeNull()
    }
  )

  it.each(["available", "trashed", "inaccessible", "needs_reconnect"] as const)(
    "requests Drive thumbnails only for available files: %s", (status) => {
      const [item] = buildLibraryItems([], [{
        id: "drive-doc", name: "Plan", mimeType: "application/pdf",
        webViewLink: "https://drive.google.com/file/d/file-id/view", modifiedAt: null, status,
      }], [])
      expect(item.previewPath).toBe(status === "available"
        ? "/api/integrations/google-drive/documents/drive-doc/preview" : undefined)
      expect(item.href).toBe("https://drive.google.com/file/d/file-id/view")
    }
  )
})


const libraryMocks = vi.hoisted(() => ({ context: vi.fn(), capabilities: vi.fn(), profile: vi.fn(), projection: vi.fn(), entitlements: vi.fn() }))
vi.mock("@/lib/auth/request-context", () => ({ resolveOptionalAuthenticatedAppContext: libraryMocks.context }))
vi.mock("@/lib/organization/document-capabilities", () => ({ resolveDocumentCapabilities: libraryMocks.capabilities }))
vi.mock("@/lib/organization/profile-read", () => ({ readOrganizationProfileForProjection: libraryMocks.profile }))
vi.mock("@/lib/organization/document-ai-copies", () => ({ projectReadableDocumentProfile: libraryMocks.projection }))
vi.mock("@/lib/accelerator/entitlements", () => ({ fetchLearningEntitlements: libraryMocks.entitlements }))

describe("current profile document library", () => {
  const userId = "00000000-0000-4000-8000-000000000001", organizationId = "00000000-0000-4000-8000-000000000002"
  let programs: { data: { id: string; title: string }[] | null; error: { message: string } | null }
  let client: { from: ReturnType<typeof vi.fn> }
  const profile = { documents: { w9: { name: "W9.pdf", path: "org/w9.pdf" } }, policies: [{ id: "policy-1", title: "Current policy", summary: "Current summary" }], privateInternal: "Never return raw profile" }
  beforeEach(() => {
    vi.clearAllMocks()
    programs = { data: [{ id: "program-1", title: "Current program" }], error: null }
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), abortSignal: vi.fn(async () => programs) }
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query)
    client = { from: vi.fn(() => query) }
    libraryMocks.context.mockResolvedValue({ supabase: client, user: { id: userId }, activeOrg: { orgId: organizationId }, profileAudience: { isAdmin: false } })
    libraryMocks.capabilities.mockResolvedValue({ access: { supabase: client, orgId: organizationId, role: "owner" }, capabilities: { canEdit: true } })
    libraryMocks.profile.mockResolvedValue({ data: { user_id: organizationId, profile, public_slug: "current-org" }, error: null })
    libraryMocks.projection.mockResolvedValue({ profile, roadmapSections: [{ id: "vision", title: "Authorized vision", subtitle: "", slug: "vision", status: "in_progress", content: "<p>Authorized content</p>", lastUpdated: null, isPublic: false }] })
    libraryMocks.entitlements.mockResolvedValue({ hasAcceleratorAccess: true })
  })
  const request = (query = new URLSearchParams({ organizationId, expectedUserId: userId }).toString()) => new NextRequest("http://localhost/api/account/organization-document-library?" + query)
  const read = async (req = request()) => (await import("@/features/document-editing/server/profile-library")).handleProfileDocumentLibraryGet(req)
  it("requires valid expected scope before any authenticated reads", async () => {
    expect((await read(request(""))).status).toBe(400)
    expect(libraryMocks.context).not.toHaveBeenCalled()
  })
  it("rejects anonymous, changed actor and changed organization before reading sources", async () => {
    libraryMocks.context.mockResolvedValueOnce(null)
    expect((await read()).status).toBe(401)
    expect((await read(request(new URLSearchParams({ organizationId, expectedUserId: organizationId }).toString()))).status).toBe(403)
    expect((await read(request(new URLSearchParams({ organizationId: userId, expectedUserId: userId }).toString()))).status).toBe(403)
    expect(libraryMocks.capabilities).not.toHaveBeenCalled()
    expect(libraryMocks.profile).not.toHaveBeenCalled()
  })
  it.each([{ error: "Denied" }, { access: { orgId: "wrong-org" }, capabilities: { canEdit: true } }])("fails closed before profile reads on invalid authority: %j", async result => {
    libraryMocks.capabilities.mockResolvedValue(result)
    const response = await read()
    expect(response.status).toBe(403)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(libraryMocks.profile).not.toHaveBeenCalled()
  })
  it("returns only the existing normalized and audience-projected metadata", async () => {
    const response = await read(); const body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(body).toMatchObject({ userId, organizationId, canEdit: true, publicSlug: "current-org", documents: { w9: { name: "W9.pdf" } }, policyEntries: [{ title: "Current policy" }], policyProgramOptions: [{ label: "Current program" }], roadmapSections: [{ id: "vision", title: "Authorized vision", content: "<p>Authorized content</p>" }] })
    expect(body.privateInternal).toBeUndefined()
    expect(libraryMocks.profile).toHaveBeenCalledWith(client, organizationId, userId, expect.any(AbortSignal))
    expect(libraryMocks.projection).toHaveBeenCalledWith(profile, organizationId, userId)
    expect(libraryMocks.entitlements).toHaveBeenCalledWith({ supabase: client, userId, orgUserId: organizationId, isAdmin: false })
  })
  it("respects current view-only rights and roadmap entitlement removal", async () => {
    libraryMocks.capabilities.mockResolvedValue({ access: { orgId: organizationId, supabase: client, role: "board" }, capabilities: { canEdit: false } })
    libraryMocks.entitlements.mockResolvedValue({ hasAcceleratorAccess: false })
    const body = await (await read()).json()
    expect(body.canEdit).toBe(false)
    expect(body.roadmapSections).toEqual([])
    expect(body.policyEntries).toHaveLength(1)
  })
  it("keeps Free organization editing available for Drive without granting native storage", async () => {
    libraryMocks.capabilities.mockResolvedValue({ access: { orgId: organizationId, supabase: client, role: "owner" }, capabilities: { canEdit: false, reason: "upgrade" } })
    libraryMocks.entitlements.mockResolvedValue({ hasAcceleratorAccess: false })
    const body = await (await read()).json()
    expect(body.canEdit).toBe(true)
    expect(body.roadmapSections).toEqual([])
  })
  it.each([
    { data: null, error: null },
    { data: null, error: { message: "Read unavailable" } },
    { data: { user_id: "wrong-org", profile }, error: null },
  ])("does not turn missing, unavailable or foreign profiles into an empty library: %j", async result => {
    libraryMocks.profile.mockResolvedValue(result)
    expect((await read()).status).toBe(503)
    expect(libraryMocks.projection).not.toHaveBeenCalled()
  })
  it("withholds metadata on audience or association-read failures", async () => {
    libraryMocks.projection.mockRejectedValueOnce(new Error("Source revoked"))
    expect((await read()).status).toBe(503)
    programs = { data: null, error: { message: "Programs unavailable" } }
    expect((await read()).status).toBe(503)
  })
})
