import { beforeEach, describe, expect, it, vi } from "vitest"
import { listAiDocuments, loadAiDocument } from "@/features/workspace-ai/server/document-context"
const mocks = vi.hoisted(() => ({ client: vi.fn(), org: vi.fn(), storage: vi.fn(), query: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }))
vi.mock("@/lib/organization/active-org", () => ({ resolveActiveOrganization: mocks.org, canEditOrganization: (role: string) => role === "owner" }))
vi.mock("@/lib/organization/document-storage-access", () => ({ requireOrganizationDocumentStorage: mocks.storage }))
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const scope = { userId: id(1), organizationId: id(2) }
const revision = "2026-10-22T12:00:00Z"
let profile: Record<string, unknown>
beforeEach(() => {
  vi.clearAllMocks()
  profile = { roadmap: { sections: [{ id: "vision", title: "Vision", content: "<p>Safe community spaces.</p>", lastUpdated: revision }] } }
  const query = { select: vi.fn().mockReturnThis(), eq: mocks.query, single: async () => ({ data: { profile }, error: null }) }
  mocks.query.mockReturnValue(query)
  mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: scope.userId } }, error: null }) }, from: () => query })
  mocks.org.mockResolvedValue({ orgId: scope.organizationId, role: "owner" })
  mocks.storage.mockResolvedValue({ allowed: true })
})
describe("selected AI document context", () => {
  it("lists metadata only in the current organization and loads a selected saved revision", async () => {
    const options = await listAiDocuments(scope)
    expect(options).toContainEqual({ sectionId: "vision", title: "Vision", revision })
    expect(JSON.stringify(options)).not.toContain("Safe community")
    expect(options.some(item => ["budget", "calendar"].includes(item.sectionId))).toBe(false)
    const loaded = await loadAiDocument({ ...scope, sectionId: "vision", title: "Client title", revision })
    expect(loaded.section.content).toBe("<p>Safe community spaces.</p>")
    expect(loaded.section.title).toBe("Vision")
    expect(mocks.query).toHaveBeenCalledWith("user_id", scope.organizationId)
  })
  it("blocks forged users, other organizations, read-only members and missing storage access", async () => {
    await expect(listAiDocuments({ ...scope, userId: id(3) })).rejects.toThrow("Sign in")
    await expect(listAiDocuments({ ...scope, organizationId: id(3) })).rejects.toThrow("current organization")
    mocks.org.mockResolvedValueOnce({ orgId: scope.organizationId, role: "viewer" })
    await expect(listAiDocuments(scope)).rejects.toThrow("current organization")
    mocks.storage.mockResolvedValueOnce({ error: "Storage access required" })
    await expect(listAiDocuments(scope)).rejects.toThrow("Storage access required")
    expect(mocks.query).not.toHaveBeenCalled()
  })
  it("rejects stale revisions, unknown documents and oversized bodies", async () => {
    const target = { ...scope, sectionId: "vision", title: "Vision", revision }
    await expect(loadAiDocument({ ...target, revision: "stale" })).rejects.toThrow("changed")
    await expect(loadAiDocument({ ...target, sectionId: "not-a-document" })).rejects.toThrow("editable core document")
    profile = { roadmap: { sections: [{ id: "vision", title: "Vision", content: "x".repeat(60001), lastUpdated: revision }] } }
    await expect(loadAiDocument(target)).rejects.toThrow("context limit")
  })
})
