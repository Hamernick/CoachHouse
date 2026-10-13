import { beforeEach, describe, expect, it, vi } from "vitest"
import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { fetchPublicMapViewerState } from "@/features/find-map/server/viewer-state"
import { createSupabaseServerClientServerMock } from "./test-utils"

const { profileMock, activeOrgMock, cookieMock } = vi.hoisted(() => ({
  profileMock: vi.fn(), activeOrgMock: vi.fn(), cookieMock: vi.fn(),
}))
vi.mock("@/lib/devtools/audience", () => ({
  resolveProfileAudience: profileMock,
  resolveTesterMetadata: () => false,
}))
vi.mock("@/lib/organization/active-org", () => ({ resolveActiveOrganization: activeOrgMock }))
vi.mock("@/lib/organization/active-org-cookie", () => ({ readActiveOrganizationCookie: cookieMock }))

beforeEach(() => {
  profileMock.mockReset().mockResolvedValue({ isAdmin: false })
  activeOrgMock.mockReset().mockResolvedValue({ orgId: "org-1", role: "member" })
  cookieMock.mockReset().mockResolvedValue("org-1")
})

describe("shared verified user consumers", () => {
  it.each([null, { name: "AuthSessionMissingError" }])("preserves anonymous sessions without loading private context", async (error) => {
    createSupabaseServerClientServerMock.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error }) },
    })
    expect(await resolveOptionalAuthenticatedAppContext()).toBeNull()
    expect(await fetchPublicMapViewerState()).toEqual({ viewer: null })
    expect(profileMock).not.toHaveBeenCalled()
    expect(activeOrgMock).not.toHaveBeenCalled()
  })

  it("preserves private-context errors and the public viewer's anonymous fallback", async () => {
    createSupabaseServerClientServerMock.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: { message: "Auth unavailable" } }) },
    })
    await expect(resolveOptionalAuthenticatedAppContext()).rejects.toThrow("Auth unavailable")
    expect(await fetchPublicMapViewerState()).toEqual({ viewer: null })
    expect(profileMock).not.toHaveBeenCalled()
  })

  it("preserves verified identity and selected organization", async () => {
    const user = { id: "user-1", email: "user@example.test", user_metadata: {} }
    const supabase = { auth: { getUser: async () => ({ data: { user }, error: null }) } }
    createSupabaseServerClientServerMock.mockResolvedValue(supabase)
    expect(await fetchPublicMapViewerState()).toEqual({ viewer: { id: user.id, email: user.email, displayName: null, avatarUrl: null } })
    expect(await resolveOptionalAuthenticatedAppContext()).toEqual({
      supabase, user, profileAudience: { isAdmin: false }, activeOrg: { orgId: "org-1", role: "member" },
    })
    expect(activeOrgMock).toHaveBeenCalledWith(supabase, user.id, { preferredOrgId: "org-1" })
  })
})
