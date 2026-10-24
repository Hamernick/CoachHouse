"use server"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import { canManageWorkspaceFinance } from "@/lib/workspace/workspace-finance-access"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { readOpportunityReport, readOpportunitySources, type WorkspaceFinanceOpportunityInput } from "@/features/workspace-finance/server"
import { loadOpportunitySourceOptions } from "@/features/workspace-finance/server"

const reference = z.object({ organizationId: z.uuid(), id: z.uuid() }).strict()
export async function getWorkspaceOpportunity(input: { organizationId: string; id: string }) {
  if (!reference.safeParse(input).success) return { error: "Invalid opportunity." } as const
  try {
    const { activeOrg, supabase, user } = await resolveAuthenticatedAppContext()
    if (activeOrg.orgId !== input.organizationId) return { error: "Opportunity unavailable." } as const
    // Actor RLS is required for reads, including linked canvas cards.
    const { data, error } = await supabase.from("organization_finance_opportunities").select("*").eq("org_id", activeOrg.orgId).eq("id", input.id).maybeSingle()
    if (error || !data) return { error: "Opportunity unavailable." } as const
    const opportunity: WorkspaceFinanceOpportunityInput = { id: data.id, origin: data.external_provider === "manual" ? "manual" : "suggested", title: data.title, source: data.source_label, dueAt: data.due_at, status: data.status as WorkspaceFinanceOpportunityInput["status"], updatedAt: data.updated_at, sources: readOpportunitySources(data.sources), report: readOpportunityReport(data.report) }
    return { opportunity, options: await loadOpportunitySourceOptions(supabase, activeOrg.orgId, user.id) }
  } catch { return { error: "Opportunity couldn’t be loaded." } as const }
}

export async function deleteWorkspaceOpportunity(input: { organizationId: string; id: string; updatedAt: string }) {
  if (!reference.extend({ updatedAt: z.iso.datetime({ offset: true }) }).safeParse(input).success) return { error: "Reload this opportunity before deleting it." }
  try {
    const { activeOrg, supabase, user } = await resolveAuthenticatedAppContext()
    if (activeOrg.orgId !== input.organizationId) return { error: "Your organization changed. Reopen this opportunity." }
    if (!(await canManageWorkspaceFinance({ activeOrg, supabase, userId: user.id }))) return { error: "Only organization owners and Finance managers can delete opportunities." }
    const { data, error } = await createSupabaseAdminClient().from("organization_finance_opportunities").delete().eq("id", input.id).eq("org_id", activeOrg.orgId).eq("external_provider", "manual").eq("updated_at", input.updatedAt).select("id").maybeSingle()
    if (error || !data) return { error: "This opportunity changed or is unavailable. Reload before deleting it." }
    for (const path of ["/workspace", "/my-organization", "/organization/workspace"]) revalidatePath(path)
    return { ok: true } as const
  } catch { return { error: "Unable to delete this opportunity." } }
}
