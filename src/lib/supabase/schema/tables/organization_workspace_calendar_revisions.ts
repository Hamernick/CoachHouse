export type OrganizationWorkspaceCalendarRevisionsTable = {
  Row: { org_id: string; revision: number; updated_at: string }
  Insert: { org_id: string; revision?: number; updated_at?: string }
  Update: { revision?: number; updated_at?: string }
  Relationships: [{
    foreignKeyName: "organization_workspace_calendar_revisions_org_id_fkey"
    columns: ["org_id"]
    isOneToOne: true
    referencedRelation: "organizations"
    referencedColumns: ["user_id"]
  }]
}
