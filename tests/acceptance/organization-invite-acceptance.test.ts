import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSupabaseServerClientServerMock, resetTestMocks } from "./test-utils"
import { getOrganizationInviteRedirect } from "@/lib/auth/organization-invite"
import { resolveOnboardingRequirements } from "@/lib/onboarding/requirements"

const { admin, directory, milestone } = vi.hoisted(() => ({ admin: vi.fn(), directory: vi.fn(), milestone: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: admin }))
vi.mock("@/app/actions/organization-access/invites-helpers", () => ({ ensureInvitedMemberInOrgDirectory: directory }))
vi.mock("@/lib/user-journey", () => ({ trackUserJourneyMilestone: milestone }))

import { acceptOrganizationInviteActionImpl as accept } from "@/app/actions/organization-access/invites-acceptance"

const user = { id: "invitee", email: "invited@example.test", email_confirmed_at: "2026-10-20T00:00:00Z", user_metadata: { onboarding_intent_focus: "build" } }
const invite = { id: "invite", org_id: "existing-org", email: "Invited@Example.test", role: "board", token: "sample", expires_at: "2099-01-01T00:00:00Z", accepted_at: null as string | null }

function setup(options: { user?: typeof user | null; invite?: typeof invite | null; membership?: { role: string } | null; writeError?: object } = {}) {
  createSupabaseServerClientServerMock.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.user === undefined ? user : options.user }, error: null }) } })
  const upsert = vi.fn().mockResolvedValue({ error: options.writeError ?? null })
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
  const inviteQuery = { eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: options.invite === undefined ? invite : options.invite, error: null }) }) }
  const membershipQuery = { eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: options.membership ?? null, error: null }) }
  membershipQuery.eq.mockReturnValue(membershipQuery)
  const from = vi.fn((table: string) => {
    if (table === "organization_invites") return { select: vi.fn().mockReturnValue(inviteQuery), update }
    if (table === "organization_memberships") return { upsert, select: vi.fn().mockReturnValue(membershipQuery) }
    throw new Error(`Unexpected write/read: ${table}`)
  })
  admin.mockReturnValue({ from })
  return { upsert, update, from }
}

beforeEach(() => { resetTestMocks(); vi.clearAllMocks() })

describe("organization invite acceptance", () => {
  it("adds a verified invitee to the existing organization, then bypasses owner onboarding", async () => {
    const db = setup()
    const result = await accept("sample")
    expect(result).toEqual({ ok: true, orgId: "existing-org", role: "board", inviteKind: "standard" })
    expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({ org_id: "existing-org", member_id: "invitee", role: "board" }), expect.anything())
    expect(db.update).toHaveBeenCalledWith({ accepted_at: expect.any(String) })
    expect(db.from.mock.calls.map(([table]) => table)).not.toContain("organizations")
    expect(directory).toHaveBeenCalledOnce()
    expect(resolveOnboardingRequirements({ userId: user.id, organizationId: "existing-org", userMetadata: user.user_metadata, isPlatformStaff: false, organizationProfile: null, publicSlug: null }).required).toBe(false)
  })

  it.each([
    ["signed out", { user: null }],
    ["unverified", { user: { ...user, email_confirmed_at: "" } }],
    ["wrong email", { user: { ...user, email: "other@example.test" } }],
    ["metadata email only", { user: { ...user, email: "", user_metadata: { onboarding_intent_focus: "build", email: "invited@example.test" } } }],
    ["unknown", { invite: null }],
    ["expired", { invite: { ...invite, expires_at: "2020-01-01" } }],
    ["invalid expiry", { invite: { ...invite, expires_at: "invalid" } }],
    ["owner role", { invite: { ...invite, role: "owner" } }],
    ["invalid role", { invite: { ...invite, role: "root" } }],
    ["used by wrong account", { invite: { ...invite, accepted_at: "2026-10-20" }, user: { ...user, email: "other@example.test" } }],
    ["membership revoked after acceptance", { invite: { ...invite, accepted_at: "2026-10-20" } }],
  ])("denies %s without granting membership", async (_label, options) => {
    const db = setup(options)
    expect(await accept("sample")).toHaveProperty("error")
    expect(db.upsert).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
    expect(directory).not.toHaveBeenCalled()
  })

  it("reopens an accepted invite only for its current member and current role", async () => {
    const db = setup({ invite: { ...invite, accepted_at: "2026-10-20", expires_at: "2020-01-01" }, membership: { role: "member" } })
    expect(await accept("sample")).toEqual({ ok: true, orgId: "existing-org", role: "member", inviteKind: "standard" })
    expect(db.upsert).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })

  it("does not consume the invite when membership persistence fails", async () => {
    const db = setup({ writeError: { message: "database unavailable" } })
    expect(await accept("sample")).toEqual({ error: "Unable to join organization." })
    expect(db.update).not.toHaveBeenCalled()
  })
})

describe("invite redirect validation", () => {
  it.each(["//evil.test/join-organization?token=a", "/\\evil.test/join-organization?token=a", "/join-organization?token=", "/join-organization?token=a&token=b", "/workspace?token=a", "https://evil.test/join-organization?token=a"])("rejects %s", (path) => {
    expect(getOrganizationInviteRedirect(path)).toBeUndefined()
  })
  it("preserves encoded tokens while discarding unrelated navigation parameters", () => {
    expect(getOrganizationInviteRedirect("/join-organization?token=a%2Bb&redirect=https://evil.test")).toBe("/join-organization?token=a%2Bb")
  })
})
