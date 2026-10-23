import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ client: vi.fn(), grant: vi.fn(), write: vi.fn(), cookie: vi.fn(), rpc: vi.fn(), member: vi.fn(), from: vi.fn(), auth: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }))
vi.mock("@/lib/organization/active-org-cookie", () => ({ writeActiveOrganizationCookie: mocks.write }))
vi.mock("@/lib/organization/support-access", () => ({ hasWorkspaceSupportAccess: mocks.grant, SUPPORT_ORGANIZATION_COOKIE: "coach_house_support_org" }))
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.cookie }) }))
import { handleOrganizationSwitchPost, setActiveOrganization } from "@/features/member-workspace/server/organization-switch"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ data: { user: { id: "actor" } } })
  mocks.grant.mockResolvedValue(false)
  mocks.rpc.mockResolvedValue({ error: null })
  mocks.member.mockResolvedValue({ data: null, error: null })
  mocks.from.mockImplementation(() => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.member }) }) }) }))
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.auth }, rpc: mocks.rpc, from: mocks.from })
})

describe("organization switching", () => {
  it("uses one live support check and audited entry without loading organization profiles", async () => {
    mocks.grant.mockResolvedValue(true)
    expect(await setActiveOrganization(" target ")).toEqual({ ok: true, orgId: "target", supportAccess: true })
    expect(mocks.grant).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("record_workspace_support_entry", { p_org: "target" })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.write).toHaveBeenCalledWith("target")
    expect(mocks.cookie).toHaveBeenCalledWith("coach_house_support_org", "target", expect.objectContaining({ httpOnly: true, sameSite: "lax" }))
  })
  it("does not change cookies when audited support entry rejects a revoked grant or missing target", async () => {
    mocks.grant.mockResolvedValue(true)
    mocks.rpc.mockResolvedValue({ error: { message: "denied" } })
    expect(await setActiveOrganization("target")).toHaveProperty("error")
    expect(mocks.write).not.toHaveBeenCalled()
    expect(mocks.cookie).not.toHaveBeenCalled()
  })
  it("requires membership for non-support access and clears support mode", async () => {
    expect(await setActiveOrganization("target")).toHaveProperty("error")
    expect(mocks.write).not.toHaveBeenCalled()
    mocks.member.mockResolvedValue({ data: { org_id: "target" }, error: null })
    expect(await setActiveOrganization("target")).toEqual({ ok: true, orgId: "target", supportAccess: false })
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.cookie).toHaveBeenCalledWith("coach_house_support_org", "", expect.objectContaining({ maxAge: 0 }))
  })
  it("permits return to the actor's own workspace without a support grant", async () => {
    expect(await setActiveOrganization("actor")).toEqual({ ok: true, orgId: "actor", supportAccess: false })
    expect(mocks.grant).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it("rejects anonymous users before changing selection", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null } })
    expect(await setActiveOrganization("target")).toEqual({ error: "Not authenticated." })
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it("accepts only same-origin JSON requests and returns no-store results", async () => {
    const request = (origin: string, body = '{"orgId":"actor"}') => new Request("https://coachhouse.app/api/account/active-organization", {
      method: "POST", headers: { origin, "content-type": "application/json" }, body,
    })
    expect((await handleOrganizationSwitchPost(request("https://other.example"))).status).toBe(403)
    expect((await handleOrganizationSwitchPost(request(""))).status).toBe(403)
    expect(mocks.auth).not.toHaveBeenCalled()
    const response = await handleOrganizationSwitchPost(request("https://coachhouse.app"))
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({ ok: true, orgId: "actor", supportAccess: false })
  })
})
