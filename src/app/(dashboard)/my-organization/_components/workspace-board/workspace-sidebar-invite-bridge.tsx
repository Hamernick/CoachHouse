"use client"

import { useWorkspaceManagement } from "@/features/workspace-management/client"
import { WorkspaceBoardInviteSheet } from "./workspace-board-invite-sheet"
import type { WorkspaceCollaborationInvite, WorkspaceMemberOption } from "./workspace-board-types"

/** Reuse the existing server-authorized access flow from the sidebar menu. */
export function WorkspaceSidebarInviteBridge(props: {
  canInvite: boolean
  members: WorkspaceMemberOption[]
  invites: WorkspaceCollaborationInvite[]
  onInvitesChange: (invites: WorkspaceCollaborationInvite[]) => void
}) {
  const context = useWorkspaceManagement()
  const request = context?.accessRequest
  if (!request || request.orgId !== context?.scope?.orgId) return null
  return <WorkspaceBoardInviteSheet
    {...props}
    open
    workspaceName={request.workspace.name}
    initialAudience="temporary"
    initialAccessLevel="editor"
    onOpenChange={(open) => { if (!open) context.setAccessRequest(null) }}
    restoreFocus={() => request.returnFocus.focus()}
  />
}
