export type OrganizationWorkspaceObjectivesTable = {
  Row: {
    id: string
    org_id: string
    group_id: string | null
    title: string
    description: string | null
    status: string
    priority: string
    kind: string
    source_type: string
    source_key: string | null
    due_at: string | null
    completed_at: string | null
    position_rank: number
    created_by: string | null
    updated_by: string | null
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    org_id: string
    group_id?: string | null
    title: string
    description?: string | null
    status?: string
    priority?: string
    kind?: string
    source_type?: string
    source_key?: string | null
    due_at?: string | null
    completed_at?: string | null
    position_rank?: number
    created_by?: string | null
    updated_by?: string | null
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    org_id?: string
    group_id?: string | null
    title?: string
    description?: string | null
    status?: string
    priority?: string
    kind?: string
    source_type?: string
    source_key?: string | null
    due_at?: string | null
    completed_at?: string | null
    position_rank?: number
    created_by?: string | null
    updated_by?: string | null
    created_at?: string
    updated_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "organization_workspace_objectives_org_id_fkey"
      columns: ["org_id"]
      referencedRelation: "organizations"
      referencedColumns: ["user_id"]
    },
    {
      foreignKeyName: "organization_workspace_objectives_group_id_fkey"
      columns: ["group_id"]
      referencedRelation: "organization_workspace_objective_groups"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "organization_workspace_objectives_created_by_fkey"
      columns: ["created_by"]
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "organization_workspace_objectives_updated_by_fkey"
      columns: ["updated_by"]
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
  ]
}
