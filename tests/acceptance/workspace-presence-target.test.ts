import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { MemberWorkspaceHeaderState } from "@/features/member-workspace/types"
vi.mock("@/features/organization-workspace-support", () => ({
  OrganizationWorkspaceSupportPanel: ({ organizationId }: { organizationId: string }) => createElement("span", { "data-presence-target": organizationId }),
}))
vi.mock("@/features/member-workspace/components/shell/member-workspace-org-switcher", () => ({
  MemberWorkspaceOrgSwitcher: () => createElement("button", null, "Choose organization"),
}))
import { MemberWorkspaceSidebarHeader } from "@/features/member-workspace/components/shell/member-workspace-sidebar-header"
const state: MemberWorkspaceHeaderState = {
  activeOrganization: { orgId: "account-fallback", role: "owner", name: "My organization", publicSlug: null, imageUrl: null },
  accessibleOrganizations: [], canSearchSupport: true,
}
describe("presence requires a persisted organization target", () => {
  it("keeps the switcher but omits presence for an unpersisted account fallback", () => {
    const html = renderToStaticMarkup(createElement(MemberWorkspaceSidebarHeader, { state }))
    expect(html).toContain("Choose organization")
    expect(html).not.toContain("data-presence-target")
  })
  it.each([false, true])("uses the verified page target for ordinary/support workspaces (support=%s)", supportAccess => {
    const html = renderToStaticMarkup(createElement(MemberWorkspaceSidebarHeader, { state: {
      ...state, presenceOrganizationId: "persisted-org", activeOrganization: { ...state.activeOrganization, supportAccess },
    } }))
    expect(html).toContain('data-presence-target="persisted-org"')
    expect(html).not.toContain('data-presence-target="account-fallback"')
  })
})
