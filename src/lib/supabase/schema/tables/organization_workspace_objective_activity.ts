import type { Json } from "../json"

export type OrganizationWorkspaceObjectiveActivityTable = {
  Row: {
    id: string
    objective_id: string
    org_id: string
    actor_id: string | null
    event_type: string
    payload: Json
    created_at: string
  }
  Insert: {
    id?: string
    objective_id: string
    org_id: string
    actor_id?: string | null
    event_type: string
    payload?: Json
    created_at?: string
  }
  Update: {
    id?: string
    objective_id?: string
    org_id?: string
    actor_id?: string | null
    event_type?: string
    payload?: Json
    created_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "organization_workspace_objective_activity_objective_id_fkey"
      columns: ["objective_id"]
      referencedRelation: "organization_workspace_objectives"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "organization_workspace_objective_activity_org_id_fkey"
      columns: ["org_id"]
      referencedRelation: "organizations"
      referencedColumns: ["user_id"]
    },
    {
      foreignKeyName: "organization_workspace_objective_activity_actor_id_fkey"
      columns: ["actor_id"]
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
  ]
}
