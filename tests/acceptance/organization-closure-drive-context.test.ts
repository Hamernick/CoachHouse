import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const mocks = vi.hoisted(() => ({ auth: vi.fn(), organization: vi.fn(), rpc: vi.fn() }))
vi.mock("@/lib/supabase/route", () => ({ createSupabaseRouteHandlerClient: () => ({ auth: { getUser: mocks.auth } }) }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("@/lib/organization/active-org", () => ({ resolveActiveOrganization: mocks.organization, canEditOrganization: (role: string) => ["owner", "admin", "staff"].includes(role) }))
import { requireGoogleDriveContext } from "@/features/google-drive/server/context"

const request = () => new NextRequest("https://example.org/api/integrations/google-drive/documents")
describe("Drive organization lifecycle admission", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ data: { user: { id: "actor" } }, error: null })
    mocks.organization.mockResolvedValue({ orgId: "organization", role: "staff" })
    mocks.rpc.mockResolvedValue({ data: true, error: null })
  })
  it("binds each admission to the authenticated actor and resolved organization", async () => {
    const context = await requireGoogleDriveContext(request(), new NextResponse(), true)
    expect(mocks.rpc).toHaveBeenCalledWith("authorize_organization_drive_access", { p_actor_id: "actor", p_org_id: "organization", p_write: true })
    await context.recheck()
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
  })
  it.each([{ data: false, error: null }, { data: null, error: new Error("Unavailable") }])("fails closed without current admission", async result => {
    mocks.rpc.mockResolvedValue(result)
    await expect(requireGoogleDriveContext(request(), new NextResponse())).rejects.toMatchObject({ code: "forbidden" })
  })
  it("rechecks expiry or revocation after provider work", async () => {
    const context = await requireGoogleDriveContext(request(), new NextResponse())
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    await expect(context.recheck()).rejects.toMatchObject({ code: "forbidden" })
  })
  it("preserves explicit shared-connection revocation without new organization admission", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    const context = await requireGoogleDriveContext(request(), new NextResponse(), true, "revoke")
    await context.recheck()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("keeps ordinary membership and support restrictions", async () => {
    mocks.organization.mockResolvedValue({ orgId: "organization", role: "board" })
    await expect(requireGoogleDriveContext(request(), new NextResponse(), true)).rejects.toMatchObject({ code: "forbidden" })
    mocks.organization.mockResolvedValue({ orgId: "organization", role: "admin", supportAccess: true })
    await expect(requireGoogleDriveContext(request(), new NextResponse())).rejects.toMatchObject({ code: "forbidden" })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
