export type WorkspaceSummary = { id: string | null; name: string }
export type WorkspaceManagementScope = {
  orgId: string
  currentId: string | null
  canEdit: boolean
  workspaces: WorkspaceSummary[]
}
