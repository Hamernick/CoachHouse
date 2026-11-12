vi.mock("@/lib/organization/document-file-audience", () => ({ filterDocumentFileAudience: async (rows: unknown[]) => rows }))
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ session: vi.fn(), access: vi.fn(), rpc: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.session }))
vi.mock("@/lib/organization/document-access", () => ({ resolveOrganizationDocumentAccess: mocks.access }))
import { loadOrganizationDocuments } from "@/features/member-workspace/server/organization-documents"
const client = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "verified-actor" } }, error: null })) } }
const reads: Array<{ table: string; organization: string }> = []
const dataClient = { from: (table: string) => ({
  select() { return this }, eq(_column: string, org: string) { reads.push({ table, organization: org }); return this },
  is() { return this }, order: async () => ({ data: [], error: null }),
  maybeSingle: async () => ({ data: { profile: { roadmap: { sections: [{ id: "vision", title: "Restricted title", content: "Restricted body" }, { id: "values", content: "Readable body" }] } } }, error: null }),
}) }
beforeEach(() => {
  vi.clearAllMocks(); reads.length = 0
  mocks.rpc.mockResolvedValue({ data: { blockedSectionIds: ["vision"], complete: false }, error: null })
  mocks.session.mockResolvedValue(client)
  mocks.access.mockResolvedValue({ supabase: dataClient, orgId: "document-org", role: "admin", supportAccess: true })
})
describe("admin asset document loader", () => {
  it("uses verified document scope and retains the real actor independently of the surrounding admin workspace", async () => {
    const result = await loadOrganizationDocuments("document-org")
    expect(result).toMatchObject({ userId: "verified-actor", files: [], drive: [] })
    expect(mocks.access).toHaveBeenCalledWith(client, "verified-actor", "document-org")
    expect(reads).toHaveLength(3)
    expect(reads.every(read => read.organization === "document-org")).toBe(true)
  })
  it("denies revoked support before any document reads", async () => {
    mocks.access.mockResolvedValue({ error: "revoked" })
    expect(await loadOrganizationDocuments("document-org")).toHaveProperty("error")
    expect(reads).toHaveLength(0)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})


it("withholds saved document copies from member lists, rechecks access, and fails closed on outages", async () => {
  const result = await loadOrganizationDocuments("document-org")
  expect(JSON.stringify(result)).not.toContain("Restricted")
  expect(JSON.stringify(result)).toContain("Readable body")
  expect(mocks.rpc).toHaveBeenCalledWith("read_workspace_ai_document_copy_sources", expect.objectContaining({ p_org_id: "document-org", p_actor_id: "verified-actor" }))
  mocks.rpc.mockResolvedValue({ data: { blockedSectionIds: [], complete: false }, error: null })
  expect(JSON.stringify(await loadOrganizationDocuments("document-org"))).toContain("Restricted body")
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "private failure" } })
  expect(await loadOrganizationDocuments("document-org")).toEqual({ error: "Unable to load organization documents. Try again." })
})
