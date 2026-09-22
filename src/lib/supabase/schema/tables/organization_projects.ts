import type { Json } from "../json"

export type OrganizationProjectsTable = {
  Row: {
    id: string
    org_id: string
    canonical_org_id: string | null
    project_kind: string
    name: string
    description: string | null
    status: string
    priority: string
    progress: number
    start_date: string
    guided_setup?: Json | null
    creation_request_id?: string | null
    schedule_confirmed?: boolean
    end_date: string
    client_name: string | null
    option_settings?: Json | null
    type_label: string | null
    duration_label: string | null
    tags: string[]
    member_labels: string[]
    task_count: number
    created_source: string
    starter_seed_key: string | null
    starter_seed_version: number | null
    created_by: string | null
    updated_by: string | null
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    org_id: string
    canonical_org_id?: string | null
    project_kind?: string
    name: string
    description?: string | null
    status?: string
    priority?: string
    progress?: number
    start_date: string
    guided_setup?: Json | null
    creation_request_id?: string | null
    schedule_confirmed?: boolean
    end_date: string
    client_name?: string | null
    option_settings?: Json | null
    type_label?: string | null
    duration_label?: string | null
    tags?: string[]
    member_labels?: string[]
    task_count?: number
    created_source?: string
    starter_seed_key?: string | null
    starter_seed_version?: number | null
    created_by?: string | null
    updated_by?: string | null
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    org_id?: string
    canonical_org_id?: string | null
    project_kind?: string
    name?: string
    description?: string | null
    status?: string
    priority?: string
    progress?: number
    start_date?: string
    guided_setup?: Json | null
    creation_request_id?: string | null
    schedule_confirmed?: boolean
    end_date?: string
    client_name?: string | null
    option_settings?: Json | null
    type_label?: string | null
    duration_label?: string | null
    tags?: string[]
    member_labels?: string[]
    task_count?: number
    created_source?: string
    starter_seed_key?: string | null
    starter_seed_version?: number | null
    created_by?: string | null
    updated_by?: string | null
    created_at?: string
    updated_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "organization_projects_org_id_fkey"
      columns: ["org_id"]
      referencedRelation: "organizations"
      referencedColumns: ["user_id"]
    },
    {
      foreignKeyName: "organization_projects_canonical_org_id_fkey"
      columns: ["canonical_org_id"]
      referencedRelation: "organizations"
      referencedColumns: ["user_id"]
    },
    {
      foreignKeyName: "organization_projects_created_by_fkey"
      columns: ["created_by"]
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "organization_projects_updated_by_fkey"
      columns: ["updated_by"]
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
  ]
}
