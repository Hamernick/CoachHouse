import { OrganizationWorkspaceSupportPanel } from "@/features/organization-workspace-support"
import type { MemberWorkspaceHeaderState } from "../../types"
import { MemberWorkspaceOrgSwitcher } from "./member-workspace-org-switcher"

export function MemberWorkspaceSidebarHeader({
  state,
}: {
  state: MemberWorkspaceHeaderState | null
}) {
  if (!state) return null

  return (
    <>
    <MemberWorkspaceOrgSwitcher
      presentation="account-menu"
      canSearchSupport={state.canSearchSupport}
      activeOrganization={state.activeOrganization}
      organizations={state.accessibleOrganizations}
    />
    {state.presenceOrganizationId ? <OrganizationWorkspaceSupportPanel organizationId={state.presenceOrganizationId} supportAccess={state.activeOrganization.supportAccess} /> : null}
    </>
  )
}
