import { beforeEach, describe, expect, it, vi } from "vitest"
import { createOrganizationScopedFetch, mergeSupportSearchResults, mapSupportOrganization } from "@/features/organization-workspace-support/lib"

const mocks = vi.hoisted(() => ({ scope: vi.fn(), cookie: vi.fn(), rpc: vi.fn(), auth: vi.fn() }))
vi.mock("@/lib/feature-flags", () => ({ organizationWorkspaceSupportEnabled: true }))
vi.mock("@/server/organization/request-scope", () => ({ readOrganizationRequestScope: mocks.scope }))
vi.mock("@/lib/organization/active-org-cookie", () => ({ readActiveOrganizationCookie: mocks.cookie }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => client() }))
import { searchSupportOrganizations, syncWorkspaceSupportPresence } from "@/features/organization-workspace-support/server/actions"
import { resolveActiveOrganization } from "@/lib/organization/active-org"

function client(memberships: Array<{ org_id: string; role: string }> = []) {
  return { auth: { getUser: mocks.auth }, rpc: mocks.rpc, from: (table: string) => ({ select: () => ({ eq: () => ({
    returns: async () => ({ data: memberships }),
    maybeSingle: async () => ({ data: table === "organizations" ? { user_id: "support-org" } : null }),
  }) }) }) }
}

describe("workspace support search and scope", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.scope.mockResolvedValue({ explicit: null, support: null })
    mocks.cookie.mockResolvedValue("member-org")
    mocks.auth.mockResolvedValue({ data: { user: { id: "actor" } }, error: null })
    mocks.rpc.mockResolvedValue({ data: false, error: null })
  })
  it("keeps the default membership list small and does not retain old search results", () => {
    const memberships = [{ orgId: "mine", name: "My organization" }, { orgId: "temporary", name: "Temporary workspace" }]
    const results = [{ orgId: "other", name: "Other organization" }]
    expect(mergeSupportSearchResults(memberships, results, "")).toEqual(memberships)
    expect(mergeSupportSearchResults(memberships, results, "Other")).toEqual(results)
    expect(mergeSupportSearchResults(memberships, results, "")).not.toContain(results[0])
  })
  it("deduplicates membership and admin search results", () => {
    const member = { orgId: "one", name: "One" }
    expect(mergeSupportSearchResults([member], [{ ...member }], "One")).toEqual([member])
  })
  it("matches an unnamed workspace by the displayed contact email and name", () => {
    const organization = { orgId: "unnamed", name: "Unnamed organization", contactName: "Karen Jones", contactEmail: "karen@offshootz.example" }
    expect(mergeSupportSearchResults([organization], [], "KAREN@Offshootz")).toEqual([organization])
    expect(mergeSupportSearchResults([organization], [], "Jones Karen")).toEqual([organization])
  })
  it("matches punctuation-free and spaced organization names", () => {
    const organization = { orgId: "one", name: "CalebsOrganization" }
    expect(mergeSupportSearchResults([organization], [], "calebs organization")).toEqual([organization])
  })
  it("retains membership permissions while enriching a duplicate remote result", () => {
    const member: { orgId: string; name: string; role: string; contactEmail: string | null } = { orgId: "one", name: "One", role: "board", contactEmail: null }
    const remote = { ...member, role: "admin", contactEmail: "person@example.org" }
    expect(mergeSupportSearchResults([member], [remote], "One")).toEqual([{ ...member, contactName: undefined, contactEmail: "person@example.org" }])
  })
  it("includes the matching member identity when mapping a server search result", () => {
    expect(mapSupportOrganization({ org_id: "org", name: "Org", image_url: null, public_slug: null,
      owner_name: "Owner", owner_email: "owner@example.org", contact_name: "Karen", contact_email: "karen@example.org", total_count: 1 }))
      .toMatchObject({ orgId: "org", contactName: "Karen", contactEmail: "karen@example.org" })
  })
  it("requests a bounded ranked page and exposes owner contact identity", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ org_id: "org", name: "Unnamed organization", image_url: null, public_slug: null,
      owner_name: null, owner_email: "karen@offshootz.example", contact_name: null, contact_email: "karen@offshootz.example", total_count: 76 }], error: null })
    const result = await searchSupportOrganizations("  karen@offshootz  ", 20)
    expect(mocks.rpc).toHaveBeenCalledWith("search_workspace_support_organizations_v2", { p_query: "karen@offshootz", p_offset: 20 })
    expect(result).toMatchObject({ total: 76, hasMore: true, organizations: [{ contactEmail: "karen@offshootz.example" }] })
  })
  it("does not expose returned identity when the RPC denies authorization", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ owner_email: "private@example.org" }], error: { code: "42501" } })
    const result = await searchSupportOrganizations("Karen")
    expect(result.organizations).toEqual([])
    expect(result.error).toBeTruthy()
  })
  it("rejects an invalid page before accessing the directory", async () => {
    expect((await searchSupportOrganizations("Karen", -1)).error).toBeTruthy()
    expect((await searchSupportOrganizations("Karen", Number.NaN)).error).toBeTruthy()
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("requires authenticated identity search and keeps an empty query local", async () => {
    expect((await searchSupportOrganizations("")).organizations).toEqual([])
    expect(mocks.auth).not.toHaveBeenCalled()
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null })
    expect((await searchSupportOrganizations("Karen")).error).toBeTruthy()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("allows only a live explicit grant to resolve a support workspace", async () => {
    mocks.cookie.mockResolvedValue("support-org")
    mocks.scope.mockResolvedValue({ explicit: null, support: "support-org" })
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    await expect(resolveActiveOrganization(client() as never, "actor")).resolves.toEqual({ orgId: "support-org", role: "admin", supportAccess: true })
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    await expect(resolveActiveOrganization(client() as never, "actor")).rejects.toThrow("revoked")
  })
  it("fails closed on an authorization lookup error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "network" } })
    await expect(resolveActiveOrganization(client() as never, "actor")).rejects.toThrow("verify")
  })
  it("retains the old tab target after another tab changes the cookie", async () => {
    mocks.scope.mockResolvedValue({ explicit: "old-org", support: "new-org" })
    mocks.cookie.mockResolvedValue("new-org")
    await expect(resolveActiveOrganization(client([{ org_id: "old-org", role: "staff" }]) as never, "actor")).resolves.toEqual({ orgId: "old-org", role: "staff" })
  })
  it("does not silently redirect a revoked explicit target into the actor's own workspace", async () => {
    mocks.scope.mockResolvedValue({ explicit: "revoked-org", support: null })
    await expect(resolveActiveOrganization(client() as never, "actor")).rejects.toThrow("no longer have access")
  })
  it("rejects an unscoped support mutation even after the support cookie expires", async () => {
    mocks.scope.mockResolvedValue({ explicit: null, support: null, method: "POST" })
    mocks.cookie.mockResolvedValue("support-org")
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    await expect(resolveActiveOrganization(client() as never, "actor")).rejects.toThrow("context is missing")
  })
  it("lets a fresh page return to the actor's own workspace after revocation", async () => {
    mocks.scope.mockResolvedValue({ explicit: null, support: "support-org", supportRequested: true, method: "GET" })
    mocks.cookie.mockResolvedValue("support-org")
    await expect(resolveActiveOrganization(client() as never, "actor")).resolves.toEqual({ orgId: "actor", role: "owner" })
  })
  it("pins same-origin fetch requests without leaking the scope header to providers", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response())
    const scoped = createOrganizationScopedFetch(fetcher, "old-org", "http://localhost:3124/workspace")
    await scoped("/workspace", { method: "POST", headers: { "next-action": "save" }, body: "draft" })
    const [, init] = fetcher.mock.calls[0]
    expect(init.method).toBe("POST")
    expect(init.body).toBe("draft")
    expect(init.headers.get("next-action")).toBe("save")
    expect(init.headers.get("x-coach-house-organization-id")).toBe("old-org")
    await scoped("https://provider.example/upload", { method: "POST" })
    expect(fetcher.mock.calls[1][1]).toEqual({ method: "POST" })
  })
  it("preserves explicitly authorized document targets inside another workspace", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response())
    const scoped = createOrganizationScopedFetch(fetcher, "workspace-A", "https://coachhouse.app/workspace", true)
    await scoped("/api/account/document-collaboration", { method: "POST", headers: { "x-coach-house-organization-id": "document-B" } })
    expect(fetcher.mock.calls[0][1].headers.get("x-coach-house-organization-id")).toBe("document-B")
    expect(fetcher.mock.calls[0][1].headers.get("x-coach-house-support-mode")).toBe("1")
  })
  it("preserves Request headers and uses the tab target over a stale supplied scope", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response())
    const scoped = createOrganizationScopedFetch(fetcher, "current", "https://coachhouse.app/workspace")
    const request = new Request("https://coachhouse.app/api/save", { method: "POST", headers: { "content-type": "application/json", "x-coach-house-organization-id": "stale" } })
    await scoped(request)
    expect(fetcher.mock.calls[0][0]).toBe(request)
    expect(fetcher.mock.calls[0][1].headers.get("content-type")).toBe("application/json")
    expect(fetcher.mock.calls[0][1].headers.get("x-coach-house-organization-id")).toBe("current")
  })
  it("marks a missing presence target terminal without exposing database details", async () => {
    mocks.scope.mockResolvedValue(null)
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "PRIVATE database detail" } })
    const result = await syncWorkspaceSupportPresence({ organizationId: "missing", sessionId: "session", path: "/workspace", position: null, editing: false })
    expect(result).toMatchObject({ code: "organization_unavailable", retryable: false })
    expect(JSON.stringify(result)).not.toContain("PRIVATE")
    expect(mocks.rpc).toHaveBeenCalledOnce()
  })
  it("keeps transient database errors retryable", async () => {
    mocks.scope.mockResolvedValue(null)
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "57014" } })
    const result = await syncWorkspaceSupportPresence({ organizationId: "existing", sessionId: "session", path: "/workspace", position: null, editing: false })
    expect(result).toHaveProperty("error")
    expect(result).not.toHaveProperty("retryable", false)
  })

})
