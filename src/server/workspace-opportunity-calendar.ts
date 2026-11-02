import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { loadOrganizationFinanceOpportunities, opportunityCalendarEvents } from "@/features/workspace-finance/server"

export async function readWorkspaceOpportunityCalendar(supabase: SupabaseClient<Database>, orgId: string, from?: string | null, to?: string | null) {
  // Same actor-scoped, bounded feed read; never expose private opportunities publicly.
  return opportunityCalendarEvents(await loadOrganizationFinanceOpportunities({ supabase, orgId }), orgId, from, to)
}
