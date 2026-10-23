import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const mocks = vi.hoisted(() => ({ client: vi.fn(), active: vi.fn(), capabilities: vi.fn(), upload: vi.fn(), signed: vi.fn() }))
vi.mock("@/lib/supabase/route", () => ({ createSupabaseRouteHandlerClient: mocks.client }))
vi.mock("@/lib/organization/document-capabilities", () => ({ resolveDocumentCapabilities: mocks.capabilities }))
vi.mock("@/lib/organization/active-org", () => ({ resolveActiveOrganization: mocks.active, canEditOrganization: (role: string) => role === "admin" }))
import { POST } from "@/app/api/account/org-media/route"
const target = "11111111-1111-1111-1111-111111111111"
const session = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "coach" } }, error: null })) } }
function request() {
  const body = new FormData()
  body.set("file", new File(["fixture"], "fixture.png", { type: "image/png" }))
  return new NextRequest("https://example.test/api/account/org-media?kind=roadmap-inline", { method: "POST", body,
    headers: { origin: "https://example.test", "x-coach-house-organization-id": target } })
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.client.mockReturnValue(session)
  mocks.active.mockResolvedValue({ orgId: "ambient-org", role: "admin" })
  mocks.upload.mockResolvedValue({ error: null })
  mocks.signed.mockResolvedValue({ data: { signedUrl: "https://example.test/fixture.png" }, error: null })
  mocks.capabilities.mockResolvedValue({ capabilities: { canEdit: true }, access: { orgId: target, supabase: {
    storage: { from: () => ({ upload: mocks.upload, createSignedUrl: mocks.signed }) },
  } } })
})
describe("native document image access", () => {
  it("authorizes the explicit document organization without waiting for ambient presence", async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(mocks.capabilities).toHaveBeenCalledWith(session, "coach", target)
    expect(mocks.active).not.toHaveBeenCalled()
    expect(mocks.upload.mock.calls[0][0]).toMatch(new RegExp(`^${target}/roadmap-inline/`))
  })
  it("rejects cross-origin uploads before elevated storage authorization", async () => {
    const input = request()
    input.headers.set("origin", "https://other.test")
    expect((await POST(input)).status).toBe(403)
    expect(mocks.capabilities).not.toHaveBeenCalled()
  })
  it("rejects read-only or revoked access before storage writes", async () => {
    mocks.capabilities.mockResolvedValue({ capabilities: { canEdit: false } })
    expect((await POST(request())).status).toBe(403)
    mocks.capabilities.mockResolvedValue({ error: "revoked" })
    expect((await POST(request())).status).toBe(403)
    expect(mocks.upload).not.toHaveBeenCalled()
  })
})
