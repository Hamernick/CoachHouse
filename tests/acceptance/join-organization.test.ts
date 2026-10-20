import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  captureRedirect,
  createSupabaseServerClientMock,
  createSupabaseServerClientServerMock,
  resetTestMocks,
} from "./test-utils"

const acceptOrganizationInviteActionMock = vi.hoisted(() => vi.fn())
const writeActiveOrganizationCookieMock = vi.hoisted(() => vi.fn())

vi.mock("@/app/actions/organization-access", () => ({
  acceptOrganizationInviteAction: acceptOrganizationInviteActionMock,
}))

vi.mock("@/lib/organization/active-org-cookie", () => ({
  writeActiveOrganizationCookie: writeActiveOrganizationCookieMock,
}))

describe("join organization page", () => {
  beforeEach(() => {
    resetTestMocks()
    vi.resetModules()
    vi.clearAllMocks()
    writeActiveOrganizationCookieMock.mockResolvedValue(undefined)
  })

  it("redirects signed-out invitees to signup and preserves the invite token", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    })

    const { default: Page } = await import("@/app/(auth)/join-organization/page")
    const destination = await captureRedirect(() =>
      Page({
        searchParams: Promise.resolve({ token: "invite_123" }),
      }),
    )

    expect(destination).toBe(
      "/sign-up?redirect=%2Fjoin-organization%3Ftoken%3Dinvite_123",
    )
  })

  it("does not accept an invite or write cookies during page rendering", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user_123", email: "member@example.test" } }, error: null }) },
    })
    const { default: Page } = await import("@/app/(auth)/join-organization/page")
    const page = await Page({ searchParams: Promise.resolve({ token: "invite_123" }) })
    expect(page.props.children.props.children.props.token).toBe("invite_123")
    expect(acceptOrganizationInviteActionMock).not.toHaveBeenCalled()
    expect(writeActiveOrganizationCookieMock).not.toHaveBeenCalled()
  })

  it.each([["standard", "board", "board"], ["funder", "member", "funder"]])(
    "accepts %s invites through a server action before selecting the workspace",
    async (inviteKind, role, joinedRole) => {
      acceptOrganizationInviteActionMock.mockResolvedValue({ ok: true, orgId: "org_123", role, inviteKind })
      const { joinOrganizationAction } = await import("@/app/(auth)/join-organization/actions")
      const form = new FormData()
      form.set("token", "invite_123")
      expect(await captureRedirect(() => joinOrganizationAction(null, form)))
        .toBe(`/workspace?joined=1&role=${joinedRole}`)
      expect(acceptOrganizationInviteActionMock).toHaveBeenCalledWith("invite_123")
      expect(writeActiveOrganizationCookieMock).toHaveBeenCalledWith("org_123")
    },
  )

  it("switches only the current session and retains the invite for sign-in", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    createSupabaseServerClientServerMock.mockResolvedValue({ auth: { signOut } })
    const { switchInviteAccountAction } = await import("@/app/(auth)/join-organization/actions")
    const form = new FormData()
    form.set("token", "invite_123")
    expect(await captureRedirect(() => switchInviteAccountAction(form))).toBe("/login?redirect=%2Fjoin-organization%3Ftoken%3Dinvite_123")
    expect(signOut).toHaveBeenCalledWith({ scope: "local" })
  })

  it("keeps rejected invites on the join form without changing workspace", async () => {
    acceptOrganizationInviteActionMock.mockResolvedValue({ error: "This invite was sent to a different email address." })
    const { joinOrganizationAction } = await import("@/app/(auth)/join-organization/actions")
    const form = new FormData()
    form.set("token", "invite_123")
    expect(await joinOrganizationAction(null, form)).toEqual({ error: "This invite was sent to a different email address." })
    expect(writeActiveOrganizationCookieMock).not.toHaveBeenCalled()
  })
})
