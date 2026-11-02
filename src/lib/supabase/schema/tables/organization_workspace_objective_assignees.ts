export type OrganizationWorkspaceObjectiveAssigneesTable = {
  Row: {
    objective_id: string
    org_id: string
    user_id: string
    role: string
    created_by: string | null
    created_at: string
  }
  Insert: {
    objective_id: string
    org_id: string
    user_id: string
    role?: string
    created_by?: string | null
    created_at?: string
  }
  Update: {
    objective_id?: string
    org_id?: string
    user_id?: string
    role?: string
    created_by?: string | null
    created_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "organization_workspace_objective_assignees_objective_id_fkey"
      columns: ["objective_id"]
      referencedRelation: "organization_workspace_objectives"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "organization_workspace_objective_assignees_org_id_fkey"
      columns: ["org_id"]
      referencedRelation: "organizations"
      referencedColumns: ["user_id"]
    },
    {
      foreignKeyName: "organization_workspace_objective_assignees_user_id_fkey"
      columns: ["user_id"]
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "organization_workspace_objective_assignees_created_by_fkey"
      columns: ["created_by"]
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
  ]
}
