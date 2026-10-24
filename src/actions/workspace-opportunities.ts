"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { canManageWorkspaceFinance } from "@/lib/workspace/workspace-finance-access"
import type { WorkspaceFinanceOpportunityInput } from "@/features/workspace-finance/server"
import { opportunitySourcesSchema, readOpportunitySources, sourceKey, type OpportunitySource } from "@/features/workspace-finance/server"
import { opportunityReportSchema, readOpportunityReport, opportunityReportSources, type OpportunityReport } from "@/features/workspace-finance/server"
import { loadOpportunitySourceOptions } from "@/features/workspace-finance/server"

const inputSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  source: z.string().trim().max(120),
  deadline: z.union([z.literal(""), z.iso.date()]),
  sources: opportunitySourcesSchema.optional(),
  report: opportunityReportSchema.optional(),
  updatedAt: z.iso.datetime({ offset: true }).optional(),
}).strict()

type OpportunityWrite = {
  id: string; organizationId: string; title: string; source: string; deadline: string; sources?: OpportunitySource[]; report?: OpportunityReport; updatedAt?: string
}
export async function createWorkspaceOpportunity(input: OpportunityWrite) { return persistOpportunity(input, false) }
export async function updateWorkspaceOpportunity(input: OpportunityWrite) { return persistOpportunity(input, true) }

async function persistOpportunity(input: OpportunityWrite, editing: boolean): Promise<{ opportunity: WorkspaceFinanceOpportunityInput } | { error: string }> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success || (editing && !parsed.data.updatedAt)) return { error: "Check the title, source, and timeline date." }
  let context: Awaited<ReturnType<typeof resolveAuthenticatedAppContext>>
  try { context = await resolveAuthenticatedAppContext() }
  catch { return { error: "Sign in to add an opportunity." } }
  const { activeOrg, supabase, user } = context
  if (activeOrg.orgId !== parsed.data.organizationId) return { error: "Your organization changed. Reopen this form." }
  if (!(await canManageWorkspaceFinance({ activeOrg, supabase, userId: user.id }))) {
    return { error: "Only organization owners and Finance managers can add opportunities." }
  }
  try {
    const sources = [...(parsed.data.sources ?? []), ...opportunityReportSources(readOpportunityReport(parsed.data.report))]
    if (sources.some(item => item.kind !== "link" && item.kind !== "text")) {
      const options = await loadOpportunitySourceOptions(supabase, activeOrg.orgId, user.id)
      const available = new Set(options.map(item => sourceKey(item.source)))
      if (parsed.data.report?.blocks.some(block => block.kind === "image" && block.fileId && !options.some(option => option.source.kind === "file" && option.source.id === block.fileId && /^image\/(jpeg|png|webp|gif)$/.test(option.mimeType ?? "")))) return { error: "Choose an available image from Documents." }
      if (sources.some(item => item.kind !== "link" && item.kind !== "text" && !available.has(sourceKey(item)))) return { error: "A source is no longer available. Remove it or choose another." }
    }
    const admin = createSupabaseAdminClient()
    const { id, title, source, deadline } = parsed.data
    if (editing) {
      const updated = await admin.from("organization_finance_opportunities").update({ title, source_label: source || null, due_at: deadline ? `${deadline}T12:00:00.000Z` : null, sources: parsed.data.sources ?? [], report: readOpportunityReport(parsed.data.report) })
        .eq("id", id).eq("org_id", activeOrg.orgId).eq("external_provider", "manual").eq("updated_at", parsed.data.updatedAt!).neq("status", "dismissed").select("id").maybeSingle()
      if (updated.error) return { error: "Unable to save. Your edits are still here." }
      if (!updated.data) return { error: "This opportunity changed or is no longer editable. Your edits are still here; reload before retrying." }
    }
    const { error } = editing ? { error: null } : await admin.from("organization_finance_opportunities").insert({
      id, org_id: activeOrg.orgId, title, source_label: source || null,
      due_at: deadline ? `${deadline}T12:00:00.000Z` : null,
      opportunity_type: "other", status: "new",
      external_provider: "manual", external_opportunity_id: id,
      ...(parsed.data.sources?.length ? { sources: parsed.data.sources } : {}),
      ...(parsed.data.report ? { report: parsed.data.report } : {}),
    })
    // Retrying the same submission must not create a second card or overwrite it.
    if (error && error.code !== "23505") return { error: "Unable to add this opportunity. Your entries are still here." }
    const { data, error: readError } = await admin.from("organization_finance_opportunities")
      .select("*").eq("id", id).eq("org_id", activeOrg.orgId).eq("external_provider", "manual").maybeSingle()
    if (readError || !data || !["new", "saved", "applied", "awarded", "not_awarded"].includes(data.status)) return { error: "Unable to confirm this opportunity. Try again." }
    const opportunity: WorkspaceFinanceOpportunityInput = {
      origin: "manual", updatedAt: data.updated_at, report: readOpportunityReport(data.report),
      id: data.id, title: data.title, source: data.source_label, dueAt: data.due_at,
      discoveredAt: data.discovered_at, status: data.status as WorkspaceFinanceOpportunityInput["status"],
      sources: readOpportunitySources(data.sources),
    }
    revalidatePath("/workspace")
    revalidatePath("/my-organization")
    revalidatePath("/organization/workspace")
    return { opportunity }
  } catch {
    return { error: "Unable to add this opportunity. Your entries are still here." }
  }
}
