import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), rpc: vi.fn(), admin: vi.fn() }))
vi.mock("@/lib/feature-flags", () => ({ organizationDocumentCollaborationEnabled: true, organizationWorkspaceSupportEnabled: true }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.auth }, rpc: mocks.rpc }) }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/lib/organization/document-capabilities", () => ({ resolveDocumentCapabilities: mocks.access }))
vi.mock("@/server/organization/request-scope", () => ({ readOrganizationRequestScope: async () => ({ supportRequested: true }) }))

import { handleDocumentCollaborationPost, handleDocumentPresencePost } from "@/features/organization-document-collaboration/server/route"
import { handleWorkspaceSupportPresencePost } from "@/features/organization-workspace-support/server/presence-route"

const organizationId = "11111111-1111-1111-1111-111111111111"
const sessionId = "22222222-2222-2222-2222-222222222222"
const routes = [
  ["document-collaboration", handleDocumentCollaborationPost],
  ["document-presence", handleDocumentPresencePost],
  ["workspace-support-presence", handleWorkspaceSupportPresencePost],
] as const
function request(route: string, origin = "https://coachhouse.test") {
  return new Request(`https://coachhouse.test/api/account/${route}`, { method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId, sessionId, sectionId: "origin", clientId: "actor:session", version: 0,
      path: "/workspace", position: null, editing: false }),
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ data: { user: null }, error: null })
  mocks.access.mockResolvedValue({ error: "Revoked", code: "denied" })
  mocks.rpc.mockResolvedValue({ data: false, error: null })
})
describe("poll handlers own authentication when Proxy delegates", () => {
  it.each(routes)("rejects anonymous %s before database access", async (path, handler) => {
    const response = await handler(request(path))
    expect(await response.json()).toHaveProperty("error")
    expect(mocks.auth).toHaveBeenCalledOnce()
    expect(mocks.access).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it.each(routes)("rejects cross-origin %s before authentication", async (path, handler) => {
    expect((await handler(request(path, "https://other.test"))).status).toBe(403)
    expect(mocks.auth).not.toHaveBeenCalled()
  })
  it.each(routes)("rechecks revoked access for %s", async (path, handler) => {
    mocks.auth.mockResolvedValue({ data: { user: { id: "actor" } }, error: null })
    const response = await handler(request(path))
    expect(await response.json()).toHaveProperty("error")
    expect(mocks.auth).toHaveBeenCalledOnce()
    expect(mocks.admin).not.toHaveBeenCalled()
    if (path === "workspace-support-presence") {
      expect(mocks.rpc).not.toHaveBeenCalledWith("sync_workspace_support_presence", expect.anything())
    } else expect(mocks.access).toHaveBeenCalledWith(expect.anything(), "actor", organizationId)
  })
})
