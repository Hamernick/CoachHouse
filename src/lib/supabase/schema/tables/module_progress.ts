import type { Json } from "../json"
import type { PublicEnums } from "../enums"

export type ModuleProgressTable = {
  Row: {
    id: string
    user_id: string
    module_id: string
    status: PublicEnums["module_progress_status"]
    completed_at: string | null
    step_progress: Json
    notes: Json | null
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    user_id: string
    module_id: string
    status?: PublicEnums["module_progress_status"]
    completed_at?: string | null
    step_progress?: Json
    notes?: Json | null
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    user_id?: string
    module_id?: string
    status?: PublicEnums["module_progress_status"]
    completed_at?: string | null
    step_progress?: Json
    notes?: Json | null
    created_at?: string
    updated_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "module_progress_module_id_fkey"
      columns: ["module_id"]
      referencedRelation: "modules"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "module_progress_user_id_fkey"
      columns: ["user_id"]
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
  ]
}

