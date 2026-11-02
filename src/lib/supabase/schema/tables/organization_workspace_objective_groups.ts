export type OrganizationWorkspaceObjectiveGroupsTable = {
  Row: {
    id: string
    org_id: string
    title: string
    kind: string
    source_type: string | null
    archived_at: string | null
    created_by: string | null
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    org_id: string
    title: string
    kind?: string
    source_type?: string | null
    archived_at?: string | null
    created_by?: string | null
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    org_id?: string
    title?: string
    kind?: string
    source_type?: string | null
    archived_at?: string | null
    created_by?: string | null
    created_at?: string
    updated_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "organization_workspace_objective_groups_org_id_fkey"
      columns: ["org_id"]
      referencedRelation: "organizations"
      referencedColumns: ["user_id"]
    },
    {
      foreignKeyName: "organization_workspace_objective_groups_created_by_fkey"
      columns: ["created_by"]
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
  ]
}
