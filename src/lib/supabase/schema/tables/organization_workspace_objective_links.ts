export type OrganizationWorkspaceObjectiveLinksTable = {
  Row: {
    id: string
    objective_id: string
    org_id: string
    card_id: string
    entity_type: string | null
    entity_id: string | null
    link_kind: string
    created_by: string | null
    created_at: string
  }
  Insert: {
    id?: string
    objective_id: string
    org_id: string
    card_id: string
    entity_type?: string | null
    entity_id?: string | null
    link_kind?: string
    created_by?: string | null
    created_at?: string
  }
  Update: {
    id?: string
    objective_id?: string
    org_id?: string
    card_id?: string
    entity_type?: string | null
    entity_id?: string | null
    link_kind?: string
    created_by?: string | null
    created_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "organization_workspace_objective_links_objective_id_fkey"
      columns: ["objective_id"]
      referencedRelation: "organization_workspace_objectives"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "organization_workspace_objective_links_org_id_fkey"
      columns: ["org_id"]
      referencedRelation: "organizations"
      referencedColumns: ["user_id"]
    },
    {
      foreignKeyName: "organization_workspace_objective_links_created_by_fkey"
      columns: ["created_by"]
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
  ]
}
