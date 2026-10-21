import type { Json } from "../json"

export type OrganizationBrandKitsTable = {
  Row: { org_id: string; identity: Json; updated_at: string; updated_by: string | null }
  Insert: { org_id: string; identity: Json; updated_at?: string; updated_by?: string | null }
  Update: { identity?: Json; updated_at?: string; updated_by?: string | null }
  Relationships: [{ foreignKeyName: "organization_brand_kits_org_id_fkey"; columns: ["org_id"]; isOneToOne: true; referencedRelation: "organizations"; referencedColumns: ["user_id"] }]
}
