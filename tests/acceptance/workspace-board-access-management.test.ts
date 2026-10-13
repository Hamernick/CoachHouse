import { createElement } from "react"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { WorkspaceBoardInviteSheet } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-invite-sheet"
import { OrganizationAccessMembersList } from "@/components/account-settings/sections/organization-access-members-list"

const { paywallOverlayMock } = vi.hoisted(() => ({
  paywallOverlayMock: vi.fn((_props: unknown) => null),
}))

vi.mock("@/components/paywall/paywall-overlay", () => ({
  PaywallOverlay: (props: unknown) => {
    paywallOverlayMock(props)
    return null
  },
}))

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

function createOrganizationAccessState(
  overrides: Record<string, unknown> = {}
) {
  return {
    loading: false,
    loadError: null,
    members: [],
    invites: [],
    requests: [],
    adminsCanInvite: false,
    staffCanManageCalendar: false,
    canInviteTeam: false,
    canManageMembers: false,
    canEditRoles: false,
    canManageSettings: false,
    hasPaidTeamAccess: true,
    inviteCapabilityMessage: null,
    refresh: vi.fn(async () => {}),
    ...overrides,
  }
}

describe("workspace board access management", () => {
  beforeEach(() => paywallOverlayMock.mockClear())

  it.each([false, true])("gates the shared free invite entry point (manageAccess=%s)", (manageAccess) => {
    const markup = renderToStaticMarkup(
      createElement(WorkspaceBoardInviteSheet, {
        canInvite: true,
        members: [],
        invites: [],
        onInvitesChange: vi.fn(),
        manageAccess,
        organizationAccessState: createOrganizationAccessState({
          hasPaidTeamAccess: false,
          canInviteTeam: true,
        }),
      })
    )
    expect(markup).toContain(manageAccess ? "Manage access" : "Invite")
    expect(markup).not.toContain('data-slot="sheet-trigger"')
    expect(markup).not.toMatch(/<button[^>]*\sdisabled(?:=|>)/)
    expect(paywallOverlayMock.mock.calls[0]?.[0]).toMatchObject({
      open: false,
      onOpenChange: expect.any(Function),
      restoreFocus: expect.any(Function),
    })
  })

  it.each([
    { loading: true },
    { loadError: "Unable to load subscription status." },
  ])("does not expose the sheet while access is unresolved: %o", (access) => {
    const markup = renderToStaticMarkup(
      createElement(WorkspaceBoardInviteSheet, {
        canInvite: true,
        members: [],
        invites: [],
        onInvitesChange: vi.fn(),
        manageAccess: true,
        organizationAccessState: createOrganizationAccessState(access),
      })
    )
    expect(markup).not.toContain('data-slot="sheet-trigger"')
    expect(markup).toMatch(/<button[^>]*\sdisabled(?:=|>)/)
    expect(paywallOverlayMock).not.toHaveBeenCalled()
  })

  it("keeps the management drawer available to read-only members", () => {
    const markup = renderToStaticMarkup(
      createElement(WorkspaceBoardInviteSheet, {
        canInvite: false,
        members: [],
        invites: [],
        onInvitesChange: vi.fn(),
        manageAccess: true,
        organizationAccessState: createOrganizationAccessState(),
      })
    )

    expect(markup).toContain("Manage access")
    expect(markup).not.toMatch(/<button[^>]*\sdisabled(?:=|>)/)
  })

  it("keeps accepted-member role and removal controls permission-aware", () => {
    const markup = renderToStaticMarkup(
      createElement(OrganizationAccessMembersList, {
        members: [
          {
            id: "member-1",
            email: "staff@example.com",
            role: "staff",
            joinedAt: "2026-08-18T12:00:00.000Z",
          },
        ],
        pending: false,
        canEditRoles: true,
        canManageMembers: true,
        canManageTesterFlags: false,
        onRoleChange: vi.fn(),
        onTesterChange: vi.fn(),
        onRemoveMember: vi.fn(),
      })
    )

    expect(markup).toContain("staff@example.com")
    expect(markup).toContain("Remove")
  })

  it("does not expose destructive controls for the owner row", () => {
    const markup = renderToStaticMarkup(
      createElement(OrganizationAccessMembersList, {
        members: [
          {
            id: "owner-1",
            email: "owner@example.com",
            role: "owner",
            joinedAt: "2026-08-18T12:00:00.000Z",
          },
        ],
        pending: false,
        canEditRoles: true,
        canManageMembers: true,
        canManageTesterFlags: false,
        onRoleChange: vi.fn(),
        onTesterChange: vi.fn(),
        onRemoveMember: vi.fn(),
      })
    )

    expect(markup).toContain("Owner")
    expect(markup).not.toContain("Remove")
  })

  it("consolidates members and settings into the drawer", () => {
    const accessStateSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-organization-access-state.ts"
    )
    const teamSectionSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-invite-sheet-team-section.tsx"
    )
    const hoverCardSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-team-access-hover-card.tsx"
    )

    expect(accessStateSource).toContain("setMembers(result.members)")
    expect(accessStateSource).toContain(
      "setCanManageSettings(result.canManageSettings)"
    )
    expect(teamSectionSource).toContain("OrganizationAccessMembersList")
    expect(teamSectionSource).toContain("OrganizationAccessPolicyControls")
    expect(teamSectionSource).toContain("Current members")
    expect(teamSectionSource).toContain("Access settings")
    expect(hoverCardSource).toContain("manageAccess")
    expect(hoverCardSource).not.toContain("Manage members")
    expect(hoverCardSource).not.toContain("getWorkspaceEditorPath")
  })

  it("requires confirmation before removing a member", () => {
    const teamSectionSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-invite-sheet-team-section.tsx"
    )

    expect(teamSectionSource).toContain("setMemberToRemoveId")
    expect(teamSectionSource).toContain("Remove this member?")
    expect(teamSectionSource).toContain("confirmMemberRemoval")
  })
})
