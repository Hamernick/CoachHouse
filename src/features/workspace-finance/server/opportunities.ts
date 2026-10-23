import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase"

import type {
  WorkspaceFinanceOpportunityInput,
  WorkspaceFinanceOpportunityStatus,
} from "../types"
import { GRANTS_GOV_SOURCE_KEY } from "../lib/grants-gov"
import { readOpportunitySources } from "../lib/opportunity-sources"

type OrganizationFinanceOpportunityRow =
  Database["public"]["Tables"]["organization_finance_opportunities"]["Row"]

const OPPORTUNITY_STATUSES = new Set<WorkspaceFinanceOpportunityStatus>([
  "new",
  "saved",
  "applied",
  "awarded",
  "not_awarded",
])

function isWorkspaceFinanceOpportunityStatus(
  status: string
): status is WorkspaceFinanceOpportunityStatus {
  return OPPORTUNITY_STATUSES.has(status as WorkspaceFinanceOpportunityStatus)
}

export function mapOrganizationFinanceOpportunity(
  opportunity: OrganizationFinanceOpportunityRow
): WorkspaceFinanceOpportunityInput | null {
  if (!isWorkspaceFinanceOpportunityStatus(opportunity.status)) {
    return null
  }

  return {
    id: opportunity.id,
    title: opportunity.title,
    source: opportunity.source_label,
    sources: readOpportunitySources(opportunity.sources),
    dueAt: opportunity.due_at,
    discoveredAt: opportunity.discovered_at,
    status: opportunity.status,
    ...(opportunity.external_provider === GRANTS_GOV_SOURCE_KEY
      ? ({ attribution: "grants_gov" } as const)
      : {}),
  }
}

export async function loadOrganizationFinanceOpportunities({
  orgId,
  supabase,
}: {
  orgId: string
  supabase: SupabaseClient<Database>
}): Promise<WorkspaceFinanceOpportunityInput[]> {
  const { data, error } = await supabase
    .from("organization_finance_opportunities")
    .select(
      "id,org_id,title,source_label,sources,opportunity_type,due_at,status,external_provider,external_opportunity_id,source_id,discovered_at,created_at,updated_at"
    )
    .eq("org_id", orgId)
    .neq("status", "dismissed")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("discovered_at", { ascending: false })
    .limit(100)

  if (error) {
    throw new Error("Unable to load Finance opportunities.", { cause: error })
  }

  return (data ?? [])
    .map(mapOrganizationFinanceOpportunity)
    .filter((opportunity) => opportunity !== null)
}
