export type FiscalProjectReviewersTable = {
  Row: { project_id: string; user_id: string; assigned_at: string }
  Insert: { project_id: string; user_id: string; assigned_at?: string }
  Update: { project_id?: string; user_id?: string; assigned_at?: string }
  Relationships: [
    {
      foreignKeyName: "fiscal_project_reviewers_project_id_fkey"
      columns: ["project_id"]
      isOneToOne: false
      referencedRelation: "organization_projects"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "fiscal_project_reviewers_user_id_fkey"
      columns: ["user_id"]
      isOneToOne: false
      referencedRelation: "platform_staff_members"
      referencedColumns: ["user_id"]
    },
  ]
}
