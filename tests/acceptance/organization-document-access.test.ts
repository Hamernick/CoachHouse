import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"

const mocks = vi.hoisted(() => ({
  level: vi.fn(),
  scope: vi.fn(),
  admin: vi.fn(),
  active: vi.fn(),
}))
vi.mock("@/lib/admin/platform-access", () => ({
  loadPlatformAccessLevel: mocks.level,
}))
vi.mock("@/lib/admin/organization-coach-scope", () => ({
  loadOrganizationCoachActorScope: mocks.scope,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.admin,
}))
vi.mock("@/lib/organization/active-org", () => ({
  resolveActiveOrganization: mocks.active,
}))
import { resolveOrganizationDocumentAccess } from "@/lib/organization/document-access"

function client(data: Record<string, string> | null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  return {
    from: vi.fn().mockReturnValue(query),
  } as unknown as SupabaseClient<Database>
}

describe("scoped organization document access", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.level.mockResolvedValue("coach")
    mocks.scope.mockResolvedValue({
      mode: "assigned",
      organizationIds: new Set(["target-org"]),
    })
    mocks.admin.mockReturnValue(client({ user_id: "target-org" }))
    mocks.active.mockResolvedValue({ orgId: "active-org", role: "member" })
  })
  it("preserves normal active-organization access without service-role elevation", async () => {
    const session = client({ role: "member" })
    expect(await resolveOrganizationDocumentAccess(session, "user")).toEqual({
      supabase: session,
      orgId: "active-org",
      role: "member",
    })
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("rejects a member requesting another organization before creating an admin client", async () => {
    mocks.level.mockResolvedValue(null)
    expect(
      await resolveOrganizationDocumentAccess(
        client({ role: "member" }),
        "user",
        "target-org"
      )
    ).toEqual({ error: "Forbidden" })
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("rejects an unassigned coach", async () => {
    expect(
      await resolveOrganizationDocumentAccess(
        client({ role: "member" }),
        "user",
        "other-org"
      )
    ).toEqual({ error: "Forbidden" })
  })
  it("allows assigned coaches to edit the explicit target, independently of the active organization", async () => {
    const result = await resolveOrganizationDocumentAccess(
      client({ role: "member" }),
      "user",
      "target-org"
    )
    expect(result).toMatchObject({ orgId: "target-org", role: "admin" })
    expect(mocks.active).not.toHaveBeenCalled()
  })
  it("allows platform administrators with all-organization scope", async () => {
    mocks.level.mockResolvedValue("developer")
    mocks.scope.mockResolvedValue({ mode: "all" })
    expect(
      await resolveOrganizationDocumentAccess(
        client({ role: "member" }),
        "user",
        "target-org"
      )
    ).toMatchObject({ orgId: "target-org", role: "admin" })
  })
  it("rejects nonexistent organizations", async () => {
    mocks.admin.mockReturnValue(client(null))
    expect(
      await resolveOrganizationDocumentAccess(
        client({ role: "member" }),
        "user",
        "target-org"
      )
    ).toEqual({ error: "Organization not found." })
  })
})
