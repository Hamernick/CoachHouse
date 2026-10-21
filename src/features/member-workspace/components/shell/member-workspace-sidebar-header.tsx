import { setActiveOrganizationAction } from "../../actions"
import type { MemberWorkspaceHeaderState } from "../../types"
import { MemberWorkspaceOrgSwitcher } from "./member-workspace-org-switcher"

export function MemberWorkspaceSidebarHeader({
  state,
}: {
  state: MemberWorkspaceHeaderState | null
}) {
  if (!state) return null

  return (
    <MemberWorkspaceOrgSwitcher
      presentation="account-menu"
      activeOrganization={state.activeOrganization}
      organizations={state.accessibleOrganizations}
      setActiveOrganizationAction={setActiveOrganizationAction}
    />
  )
}
