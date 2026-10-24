import type { Json } from "../json"

export type OrganizationWorkspacePagesTable = {
  Row: {
    id: string
    org_id: string
    link_id: string
    title: string
    description: string
    particle_ids: string[]
    revision: number
    visibility: "private" | "public"
    published_snapshot: Json | null
    published_at: string | null
    created_at: string
    updated_at: string
    last_operation_id: string | null
    last_operation_actor: string | null
    last_operation_hash: string | null
  }
  Insert: {
    id?: string
    org_id: string
    link_id?: string
    title?: string
    description?: string
    particle_ids: string[]
    revision?: number
    visibility?: "private" | "public"
    published_snapshot?: Json | null
    published_at?: string | null
    created_at?: string
    updated_at?: string
    last_operation_id?: string | null
    last_operation_actor?: string | null
    last_operation_hash?: string | null
  }
  Update: Partial<OrganizationWorkspacePagesTable["Insert"]>
  Relationships: [{
    foreignKeyName: "organization_workspace_pages_org_id_fkey"
    columns: ["org_id"]
    isOneToOne: false
    referencedRelation: "organizations"
    referencedColumns: ["user_id"]
  }]
}
