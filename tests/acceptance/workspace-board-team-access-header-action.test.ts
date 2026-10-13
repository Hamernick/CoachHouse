import { createElement } from "react"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  useWorkspaceBoardOrganizationAccessStateMock,
  workspaceBoardTeamAccessHoverCardMock,
  paywallOverlayMock,
} = vi.hoisted(() => ({
  useWorkspaceBoardOrganizationAccessStateMock: vi.fn(),
  workspaceBoardTeamAccessHoverCardMock: vi.fn((_props: unknown) => null),
  paywallOverlayMock: vi.fn((_props: unknown) => null),
}))

vi.mock("@/components/paywall/paywall-overlay", () => ({
  PaywallOverlay: (props: unknown) => { paywallOverlayMock(props); return null },
}))

vi.mock(
  "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-organization-access-state",
  () => ({
    useWorkspaceBoardOrganizationAccessState:
      useWorkspaceBoardOrganizationAccessStateMock,
  })
)

vi.mock(
  "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-team-access-hover-card",
  () => ({
    WorkspaceBoardTeamAccessHoverCard: (props: unknown) => {
      workspaceBoardTeamAccessHoverCardMock(props)
      return null
    },
  })
)

import { WorkspaceBoardTeamAccessHeaderActionContent } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-team-access-header-action"

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

function renderAction() {
  return renderToStaticMarkup(
    createElement(WorkspaceBoardTeamAccessHeaderActionContent, {
      canInvite: false,
      members: [],
      invites: [],
      realtimeState: "connecting",
      currentUser: {
        id: "org-1",
        name: "Bright Futures Collective",
        avatarUrl: null,
      },
      onInvitesChange: vi.fn(),
    })
  )
}

describe("WorkspaceBoardTeamAccessHeaderAction", () => {
  beforeEach(() => {
    useWorkspaceBoardOrganizationAccessStateMock.mockReset()
    workspaceBoardTeamAccessHoverCardMock.mockClear()
    paywallOverlayMock.mockClear()
  })

  it("renders the team-access pill for the shell header", () => {
    useWorkspaceBoardOrganizationAccessStateMock.mockReturnValue(
      createOrganizationAccessState()
    )

    const markup = renderAction()
    const source = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-team-access-header-action.tsx"
    )

    expect(markup).toContain('data-slot="hover-card-trigger"')
    expect(markup).toContain("Bright Futures Collective")
    expect(markup).toContain("Connecting…")
    expect(markup).toContain("h-9")
    expect(markup).toContain("max-w-[13rem]")
    expect(markup).toContain("min-w-0")
    expect(markup).toContain("rounded-full")
    expect(markup).not.toContain("shadow-xs")
    expect(source).toContain('<HeaderActionsPortal slot="right">')
    expect(source).toContain(
      'ownerId: "workspace-board:team-access-header-action"'
    )
    expect(source).not.toContain("teamAccessCollapsed")
    expect(source).not.toContain("ChevronDownIcon")
  })

  it("keeps the same free-user pill visible with an upgrade dialog instead of team controls", () => {
    useWorkspaceBoardOrganizationAccessStateMock.mockReturnValue(
      createOrganizationAccessState({ hasPaidTeamAccess: false })
    )
    const markup = renderAction()
    expect(markup).toContain("Bright Futures Collective")
    expect(markup).toContain('aria-haspopup="dialog"')
    expect(markup).toContain("rounded-full")
    expect(markup).not.toContain('data-slot="hover-card-trigger"')
    expect(workspaceBoardTeamAccessHoverCardMock).not.toHaveBeenCalled()
    expect(paywallOverlayMock.mock.calls[0]?.[0]).toMatchObject({
      open: false, onOpenChange: expect.any(Function), restoreFocus: expect.any(Function),
    })
  })

  it.each([
    { loading: true, hasPaidTeamAccess: false },
    { loadError: "Unable to check access", hasPaidTeamAccess: false },
    { hasPaidTeamAccess: true, canInviteTeam: false },
  ])("does not mistake unresolved access or a paid member role for a free plan: %o", (state) => {
    useWorkspaceBoardOrganizationAccessStateMock.mockReturnValue(createOrganizationAccessState(state))
    expect(renderAction()).toContain('data-slot="hover-card-trigger"')
    expect(paywallOverlayMock).not.toHaveBeenCalled()
  })

  it("keeps loading and error state in the accessible trigger summary", () => {
    useWorkspaceBoardOrganizationAccessStateMock.mockReturnValue(
      createOrganizationAccessState({ loading: true })
    )
    expect(renderAction()).toContain("Checking team access…")
    expect(
      workspaceBoardTeamAccessHoverCardMock.mock.calls[0]?.[0]
    ).toMatchObject({
      organizationAccessLoading: true,
      organizationAccessLoadError: null,
    })

    useWorkspaceBoardOrganizationAccessStateMock.mockReturnValue(
      createOrganizationAccessState({
        loadError: "Unable to load team access.",
      })
    )
    expect(renderAction()).toContain("Team access unavailable right now.")
    expect(
      workspaceBoardTeamAccessHoverCardMock.mock.calls.at(-1)?.[0]
    ).toMatchObject({
      organizationAccessLoading: false,
      organizationAccessLoadError: "Unable to load team access.",
    })
  })
})
