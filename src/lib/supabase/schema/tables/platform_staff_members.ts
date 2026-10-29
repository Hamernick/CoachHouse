export type PlatformStaffMembersTable = {
  Row: {
    user_id: string
    access_level: "developer" | "coach"
    can_access_all_organizations: boolean
    can_access_unassigned_organizations: boolean
    granted_by: string | null
    created_at: string
    updated_at: string
  }
  Insert: {
    user_id: string
    access_level: "developer" | "coach"
    can_access_all_organizations?: boolean
    can_access_unassigned_organizations?: boolean
    granted_by?: string | null
    created_at?: string
    updated_at?: string
  }
  Update: {
    user_id?: string
    access_level?: "developer" | "coach"
    can_access_all_organizations?: boolean
    can_access_unassigned_organizations?: boolean
    granted_by?: string | null
    created_at?: string
    updated_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "platform_staff_members_user_id_fkey"
      columns: ["user_id"]
      isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "platform_staff_members_granted_by_fkey"
      columns: ["granted_by"]
      isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
  ]
}
