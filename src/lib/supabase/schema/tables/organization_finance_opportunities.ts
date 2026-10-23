import type { Json } from "../json"

export type OrganizationFinanceOpportunitiesTable = {
  Row: {
    id: string
    org_id: string
    title: string
    source_label: string | null
    sources?: Json
    opportunity_type: string
    due_at: string | null
    status: string
    external_provider: string
    external_opportunity_id: string
    source_id: string | null
    discovered_at: string
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    org_id: string
    title: string
    source_label?: string | null
    sources?: Json
    opportunity_type?: string
    due_at?: string | null
    status?: string
    external_provider: string
    external_opportunity_id: string
    source_id?: string | null
    discovered_at?: string
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    org_id?: string
    title?: string
    source_label?: string | null
    sources?: Json
    opportunity_type?: string
    due_at?: string | null
    status?: string
    external_provider?: string
    external_opportunity_id?: string
    source_id?: string | null
    discovered_at?: string
    created_at?: string
    updated_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "organization_finance_opportunities_org_id_fkey"
      columns: ["org_id"]
      referencedRelation: "organizations"
      referencedColumns: ["user_id"]
    },
    {
      foreignKeyName: "organization_finance_opportunities_source_id_fkey"
      columns: ["source_id"]
      referencedRelation: "finance_opportunity_sources"
      referencedColumns: ["id"]
    },
  ]
}
