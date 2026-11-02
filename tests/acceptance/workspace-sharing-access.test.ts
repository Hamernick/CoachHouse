import { beforeEach, describe, expect, it, vi } from "vitest"
import { executePageAccess } from "@/features/workspace-sharing/server/page-access"
import { pageAccessCommandSchema } from "@/features/workspace-sharing/lib/page-access"
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), admin: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.auth } }) }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const data = () => ({ pageId: id(10), permission: "view", canGrantManage: false, revision: 1, draft: null,
  invitations: [], replayed: false, snapshot: { version: 1, brand: { name: "Organization", organizationSlug: "organization" }, title: "Page", description: "",
    items: [{ id: id(20), title: "Selected", content: { kind: "text" } }] } })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ data: { user: { id: id(6) } }, error: null })
  mocks.admin.mockReturnValue({ rpc: mocks.rpc })
  mocks.rpc.mockResolvedValue({ data: data(), error: null })
})
describe("page guest server boundary", () => {
  it("requires sign in before any privileged read", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null })
    expect(await executePageAccess({ action: "read", pageId: id(10) })).toEqual({ signInRequired: true })
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it.each(["actorId", "orgId", "snapshot", "permission", "particleIds"])("rejects injected %s before authentication", async (key) => {
    await expect(executePageAccess({ action: "edit", pageId: id(10), operationId: id(40), expectedRevision: 1, title: "Title", description: "", [key]: id(1) })).rejects.toMatchObject({ code: "invalid" })
    expect(mocks.auth).not.toHaveBeenCalled()
  })
  it("uses verified identity and a narrow DTO without resolving an organization", async () => {
    expect(await executePageAccess({ action: "read", pageId: id(10) })).toEqual({ signInRequired: false, value: data() })
    expect(mocks.rpc).toHaveBeenCalledWith("workspace_page_guest_command", expect.objectContaining({ p_actor_id: id(6), p_page_id: id(10), p_command: { action: "read" } }))
  })
  it("normalizes recipient email and retains exact command identity for retry", async () => {
    const request = { action: "invite", pageId: id(10), operationId: id(40), invitationId: id(41), email: " PERSON@example.org ", permission: "view" }
    await executePageAccess(request); await executePageAccess(request)
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1])
    expect(mocks.rpc.mock.calls[0][1].p_command.email).toBe("person@example.org")
  })
  it.each([["42501", "scope", false], ["40001", "conflict", false], ["57014", "unavailable", true]])("maps %s without pretending a timed-out write failed", async (code, kind, uncertain) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code } })
    await expect(executePageAccess({ action: "read", pageId: id(10) })).rejects.toMatchObject({ code: kind, uncertain })
  })
  it("rejects a cross-page response", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...data(), pageId: id(11) }, error: null })
    await expect(executePageAccess({ action: "read", pageId: id(10) })).rejects.toMatchObject({ code: "scope" })
  })
  it("does not allow permission or membership changes through details editing", () => {
    expect(pageAccessCommandSchema.safeParse({ action: "edit", pageId: id(10), operationId: id(40), expectedRevision: 1, title: "Title", description: "", visibility: "public" }).success).toBe(false)
    expect(pageAccessCommandSchema.safeParse({ action: "publish", pageId: id(10) }).success).toBe(false)
  })
})
