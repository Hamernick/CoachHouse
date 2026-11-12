import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ session: vi.fn(), admin: vi.fn(), access: vi.fn(), storage: vi.fn(), auth: vi.fn(), current: vi.fn(), sources: vi.fn() }))
vi.mock("@/lib/feature-flags", () => ({ organizationDocumentCollaborationEnabled: true }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.session }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/lib/organization/document-access", () => ({ resolveOrganizationDocumentAccess: mocks.access }))
vi.mock("@/lib/organization/document-storage-access", () => ({ resolveOrganizationDocumentStorageAccess: mocks.storage, DOCUMENT_STORAGE_UPGRADE_MESSAGE: "Upgrade required" }))
import { loadOrganizationDocumentVersions } from "@/features/organization-document-collaboration/server/actions"
import { syncOrganizationDocument } from "@/features/organization-document-collaboration/server/sync-document"
import { syncDocumentPresence } from "@/features/organization-document-collaboration/server/presence"
import { documentContext } from "@/features/organization-document-collaboration/server/context"
import { canRemoveCoreDocumentImage } from "@/server/organization/core-document-asset-retention"

const scope = { organizationId: "11111111-1111-1111-1111-111111111111", sectionId: "mission_vision_values" }
const currentQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: mocks.current }
const session = { auth: { getUser: mocks.auth }, from: vi.fn(() => currentQuery) }
describe("collaboration authorization before elevated storage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    currentQuery.select.mockReturnThis(); currentQuery.eq.mockReturnThis()
    mocks.current.mockResolvedValue({ data: { user_id: scope.organizationId }, error: null })
    mocks.session.mockResolvedValue(session)
    mocks.auth.mockResolvedValue({ data: { user: { id: "actor" } }, error: null })
    mocks.access.mockResolvedValue({ orgId: scope.organizationId, role: "staff", supabase: session })
    mocks.storage.mockResolvedValue({ hasStorageAccess: true })
    mocks.sources.mockResolvedValue({ data: { blockedSectionIds: [], complete: false }, error: null })
    mocks.admin.mockReturnValue({ rpc: mocks.sources })
  })
  it("checks saved-copy sources with the current verified identity", async () => {
    await documentContext(scope)
    expect(mocks.sources).toHaveBeenCalledWith("read_workspace_ai_document_copy_sources", {
      p_org_id: scope.organizationId, p_actor_id: "actor", p_section_ids: [scope.sectionId],
    })
    mocks.sources.mockResolvedValue({ data: { blockedSectionIds: [scope.sectionId], complete: false }, error: null })
    await expect(documentContext(scope)).rejects.toMatchObject({ code: "denied" })
    mocks.sources.mockResolvedValue({ data: { blockedSectionIds: [], complete: false }, error: null })
    await expect(documentContext(scope)).resolves.toMatchObject({ role: "staff" })
  })
  it.each(["read", "write", "history", "presence"])("denies a blocked %s before reading elevated content", async mode => {
    mocks.sources.mockResolvedValue({ data: { blockedSectionIds: [scope.sectionId], complete: false }, error: null })
    const input = { ...scope, clientId: "actor:tab", version: 0 }
    const result = mode === "history" ? await loadOrganizationDocumentVersions(scope)
      : mode === "presence" ? await syncDocumentPresence(input)
      : await syncOrganizationDocument({ ...input, ...(mode === "write" ? { initialDocument: { type: "doc" } } : {}) })
    expect(result).toMatchObject({ error: "This document is no longer available. Your local edits are retained." })
    expect(result).not.toHaveProperty("section")
    expect(result).not.toHaveProperty("session")
    expect(result).not.toHaveProperty("versions")
    expect(result).not.toHaveProperty("participants")
    // The only elevated client reached is the checked source RPC, not body storage.
    expect(mocks.admin).toHaveBeenCalledTimes(1)
  })
  it("withholds history when access changes during its read", async () => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: "version", actor_id: null, content: "private history" }], error: null }) }
    mocks.admin.mockReturnValue({ rpc: mocks.sources, from: () => query })
    mocks.sources.mockResolvedValueOnce({ data: { blockedSectionIds: [], complete: false }, error: null })
      .mockResolvedValueOnce({ data: { blockedSectionIds: [scope.sectionId], complete: false }, error: null })
    expect(await loadOrganizationDocumentVersions(scope)).toEqual({ error: "This document is no longer available. Your local edits are retained." })
  })
  it("keeps source outages retryable without exposing backend details", async () => {
    mocks.sources.mockRejectedValue(new Error("private source detail"))
    await expect(documentContext(scope)).rejects.toMatchObject({ code: "unavailable", message: "Document sources could not be verified. Your local edits are retained; try again." })
  })
  it("rejects unauthenticated users before any elevated data access", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null })
    await expect(documentContext(scope)).rejects.toThrow("Sign in")
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it.each([0, 429, 500, 504])("keeps temporary Auth failure %s retryable without allowing data access", async (status) => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: { status } })
    await expect(documentContext(scope)).rejects.toMatchObject({ code: "unavailable" })
    expect(mocks.access).not.toHaveBeenCalled()
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it.each([400, 401, 403])("continues denying invalid authentication %s", async (status) => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: { status } })
    await expect(documentContext(scope)).rejects.toMatchObject({ code: "unauthenticated" })
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("denies expired or revoked organization reads before elevated core access", async () => {
    mocks.current.mockResolvedValue({ data: null, error: null })
    await expect(documentContext(scope)).rejects.toMatchObject({ code: "denied" })
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("rechecks the explicit organization and preserves the verified actor", async () => {
    await documentContext(scope, true)
    expect(mocks.access).toHaveBeenCalledWith(session, "actor", scope.organizationId)
    expect(mocks.admin).toHaveBeenCalledWith({ actorId: "actor", requestTimeoutMs: 15000 })
    expect(mocks.storage).toHaveBeenCalledWith({ supabase: session, orgId: scope.organizationId })
  })
  it("denies revoked or cross-organization access before storage", async () => {
    mocks.access.mockResolvedValue({ error: "Forbidden" })
    await expect(documentContext(scope, true)).rejects.toThrow("no longer have access")
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("permits a read-only member to view but never write", async () => {
    mocks.access.mockResolvedValue({ role: "member", supabase: session })
    await expect(documentContext(scope)).resolves.toMatchObject({ role: "member" })
    mocks.admin.mockClear()
    await expect(documentContext(scope, true)).rejects.toThrow("read-only")
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("does not silently bypass document entitlement for coaches", async () => {
    mocks.access.mockResolvedValue({ role: "admin", staffAccessLevel: "coach", supabase: session })
    mocks.storage.mockResolvedValue({ hasStorageAccess: false })
    await expect(documentContext(scope, true)).rejects.toThrow("Upgrade required")
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("allows verified workspace support to write Origin without a paid subscription", async () => {
    mocks.access.mockResolvedValue({ role: "admin", supportAccess: true, staffAccessLevel: "coach", supabase: session })
    mocks.storage.mockResolvedValue({ hasStorageAccess: false })
    await expect(documentContext({ ...scope, sectionId: "origin_story" }, true)).resolves.toMatchObject({ role: "Coach", supportAccess: true })
    expect(mocks.storage).not.toHaveBeenCalled()
    expect(mocks.access).toHaveBeenCalledWith(session, "actor", scope.organizationId)
    expect(mocks.admin).toHaveBeenCalledWith({ actorId: "actor", requestTimeoutMs: 15000 })
  })
  it("rejects revoked support before creating elevated document storage", async () => {
    mocks.access.mockResolvedValue({ error: "Workspace support access was revoked." })
    await expect(documentContext({ ...scope, sectionId: "origin_story" }, true)).rejects.toThrow("no longer have access")
    expect(mocks.storage).not.toHaveBeenCalled()
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("rejects malformed document scopes", async () => {
    await expect(documentContext({ ...scope, sectionId: "../other" })).rejects.toThrow("Invalid document")
    expect(mocks.session).not.toHaveBeenCalled()
  })
  it.each([
    [{ data: [{ id: "version" }], error: null }, false],
    [{ data: [], error: null }, true],
    [{ data: null, error: { code: "network" } }, false],
    [{ data: null, error: { code: "42P01" } }, true],
  ])("preserves version-referenced images and fails safely on cleanup lookup errors", async (result, expected) => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), contains: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue(result) }
    mocks.admin.mockReturnValue({ from: vi.fn().mockReturnValue(query) })
    expect(await canRemoveCoreDocumentImage(scope.organizationId, "/original.png")).toBe(expected)
    expect(query.eq).toHaveBeenCalledWith("org_id", scope.organizationId)
  })
})
