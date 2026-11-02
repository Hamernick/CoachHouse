import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase"

import type {
  WorkspaceFinanceOpportunityInput,
  WorkspaceFinanceOpportunityWorkflowStatus,
} from "../types"
import { GRANTS_GOV_SOURCE_KEY } from "../lib/grants-gov"
import { readOpportunityReport } from "../lib/opportunity-report"
import { readOpportunitySources } from "../lib/opportunity-sources"

type OrganizationFinanceOpportunityRow =
  Database["public"]["Tables"]["organization_finance_opportunities"]["Row"]

const OPPORTUNITY_STATUSES = new Set<WorkspaceFinanceOpportunityWorkflowStatus>([
  "new",
  "saved",
  "applied",
  "awarded",
  "not_awarded",
  "dismissed",
])

function isWorkspaceFinanceOpportunityWorkflowStatus(
  status: string
): status is WorkspaceFinanceOpportunityWorkflowStatus {
  return OPPORTUNITY_STATUSES.has(status as WorkspaceFinanceOpportunityWorkflowStatus)
}

export function mapOrganizationFinanceOpportunity(
  opportunity: OrganizationFinanceOpportunityRow
): WorkspaceFinanceOpportunityInput | null {
  if (!isWorkspaceFinanceOpportunityWorkflowStatus(opportunity.status)) {
    return null
  }

  return {
    id: opportunity.id,
    ...(opportunity.feed_position !== undefined ? { feedPosition: opportunity.feed_position } : {}),
    origin: opportunity.external_provider === "manual" ? "manual" : "suggested",
    updatedAt: opportunity.updated_at,
    report: readOpportunityReport(opportunity.report),
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
      "id,org_id,feed_position,title,source_label,sources,report,opportunity_type,due_at,status,external_provider,external_opportunity_id,source_id,discovered_at,created_at,updated_at"
    )
    .eq("org_id", orgId)
    .neq("status", "dismissed")
    .order("feed_position", { ascending: true })
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
