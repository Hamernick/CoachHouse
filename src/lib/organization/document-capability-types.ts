export type DocumentCapabilities = {
  canView: boolean
  canEdit: boolean
  canViewHistory: boolean
  reason: "editable" | "viewer" | "upgrade" | "denied"
}
