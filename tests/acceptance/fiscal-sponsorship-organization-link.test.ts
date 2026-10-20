import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn(), revalidate: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc: mocks.rpc, auth: { getUser: mocks.getUser } }) }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
import { linkFiscalOrganization, searchFiscalOrganizationLink } from "@/features/fiscal-sponsorship/server/organization-link-actions"
import { loadFiscalOrganizationApplications } from "@/features/fiscal-sponsorship/server/linked-applications"
const projectId = "20000000-0000-4000-8000-000000000001"
const organizationId = "30000000-0000-4000-8000-000000000001"
const requestId = "40000000-0000-4000-8000-000000000001"
const input = { projectId, organizationId, requestId, version: "a".repeat(32) }
const linked = { organizationId, name: "Applicant organization" }
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("FISCAL_GUEST_PROFILE_IMPORT_ENABLED", "true")
  mocks.getUser.mockResolvedValue({ data: { user: { id: organizationId, email_confirmed_at: "2026-10-20" } }, error: null })
})
afterEach(() => vi.unstubAllEnvs())
describe("fiscal application organization association", () => {
  it("rejects invalid source, target and caller identity injection before RPC", async () => {
    for (const invalid of [{ ...input, projectId: "wrong" }, { ...input, actorId: organizationId }, { ...input, version: "" }]) {
      expect(await linkFiscalOrganization(invalid)).toHaveProperty("error")
    }
    expect(await searchFiscalOrganizationLink("bad", "Org")).toHaveProperty("error")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("uses session-bound database authorization and independently reads back the exact destination", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { state: "linked", organizationId }, error: null })
      .mockResolvedValueOnce({ data: { linked, candidates: [] }, error: null })
    expect(await linkFiscalOrganization(input)).toEqual({ linked })
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "link_fiscal_organization", { p_project_id: projectId, p_org_id: organizationId, p_request_id: requestId, p_version: input.version })
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "search_fiscal_organization_link", { p_project_id: projectId, p_query: "" })
    expect(mocks.revalidate).toHaveBeenCalledWith("/workspace")
  })
  it.each(["denied", "conflict"])("never reports success for %s", async (state) => {
    mocks.rpc.mockResolvedValue({ data: { state }, error: null })
    expect(await linkFiscalOrganization(input)).toHaveProperty("error")
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("preserves uncertain commit handling when readback fails", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { state: "linked", organizationId }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "private database detail" } })
    expect(await linkFiscalOrganization(input)).toEqual({ error: expect.not.stringContaining("private database"), retryable: true })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("does not expose invalid search projection or other reviewer details", async () => {
    mocks.rpc.mockResolvedValue({ data: { linked: null, candidates: [], internalNotes: "private" }, error: null })
    expect(await searchFiscalOrganizationLink(projectId, "Org")).toEqual({ error: expect.not.stringContaining("private") })
  })
  it("loads only the requested organization projection and requires a confirmed account", async () => {
    const applications = [{ reference: projectId, projectName: "Existing application", status: "submitted", submittedAt: "2026-10-20" }]
    mocks.rpc.mockResolvedValue({ data: applications, error: null })
    expect(await loadFiscalOrganizationApplications(organizationId)).toEqual({ applications })
    expect(mocks.rpc).toHaveBeenCalledWith("list_fiscal_organization_applications", { p_org_id: organizationId })
    mocks.rpc.mockClear()
    mocks.getUser.mockResolvedValue({ data: { user: { id: organizationId } }, error: null })
    expect(await loadFiscalOrganizationApplications(organizationId)).toEqual({ applications: [] })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("fails closed on database failure instead of presenting a new application", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private detail" } })
    expect(await loadFiscalOrganizationApplications(organizationId)).toEqual({ applications: [], error: expect.not.stringContaining("private") })
  })
})
