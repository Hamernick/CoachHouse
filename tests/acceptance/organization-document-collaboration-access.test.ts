import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ session: vi.fn(), admin: vi.fn(), access: vi.fn(), storage: vi.fn(), auth: vi.fn() }))
vi.mock("@/lib/feature-flags", () => ({ organizationDocumentCollaborationEnabled: true }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.session }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/lib/organization/document-access", () => ({ resolveOrganizationDocumentAccess: mocks.access }))
vi.mock("@/lib/organization/document-storage-access", () => ({ resolveOrganizationDocumentStorageAccess: mocks.storage, DOCUMENT_STORAGE_UPGRADE_MESSAGE: "Upgrade required" }))
import { documentContext } from "@/features/organization-document-collaboration/server/context"
import { canRemoveCoreDocumentImage } from "@/server/organization/core-document-asset-retention"

const scope = { organizationId: "11111111-1111-1111-1111-111111111111", sectionId: "mission_vision_values" }
const session = { auth: { getUser: mocks.auth } }
describe("collaboration authorization before elevated storage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.session.mockResolvedValue(session)
    mocks.auth.mockResolvedValue({ data: { user: { id: "actor" } }, error: null })
    mocks.access.mockResolvedValue({ orgId: scope.organizationId, role: "staff", supabase: session })
    mocks.storage.mockResolvedValue({ hasStorageAccess: true })
    mocks.admin.mockReturnValue({})
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
  it("rechecks the explicit organization and preserves the verified actor", async () => {
    await documentContext(scope, true)
    expect(mocks.access).toHaveBeenCalledWith(session, "actor", scope.organizationId)
    expect(mocks.admin).toHaveBeenCalledWith({ actorId: "actor" })
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
    await expect(documentContext({ ...scope, sectionId: "origin_story" }, true)).resolves.toMatchObject({ role: "Coach" })
    expect(mocks.storage).not.toHaveBeenCalled()
    expect(mocks.access).toHaveBeenCalledWith(session, "actor", scope.organizationId)
    expect(mocks.admin).toHaveBeenCalledWith({ actorId: "actor" })
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
