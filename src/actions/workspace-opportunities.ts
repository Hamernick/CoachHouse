"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { canManageWorkspaceFinance } from "@/lib/workspace/workspace-finance-access"
import type { WorkspaceFinanceOpportunityInput } from "@/features/workspace-finance"

const inputSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  source: z.string().trim().max(120),
  deadline: z.union([z.literal(""), z.iso.date()]),
}).strict()

export async function createWorkspaceOpportunity(input: {
  id: string; organizationId: string; title: string; source: string; deadline: string
}): Promise<{ opportunity: WorkspaceFinanceOpportunityInput } | { error: string }> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { error: "Check the title, source, and timeline date." }
  let context: Awaited<ReturnType<typeof resolveAuthenticatedAppContext>>
  try { context = await resolveAuthenticatedAppContext() }
  catch { return { error: "Sign in to add an opportunity." } }
  const { activeOrg, supabase, user } = context
  if (activeOrg.orgId !== parsed.data.organizationId) return { error: "Your organization changed. Reopen this form." }
  if (!(await canManageWorkspaceFinance({ activeOrg, supabase, userId: user.id }))) {
    return { error: "Only organization owners and Finance managers can add opportunities." }
  }
  try {
    const admin = createSupabaseAdminClient()
    const { id, title, source, deadline } = parsed.data
    const { error } = await admin.from("organization_finance_opportunities").insert({
      id, org_id: activeOrg.orgId, title, source_label: source || null,
      due_at: deadline ? `${deadline}T12:00:00.000Z` : null,
      opportunity_type: "other", status: "new",
      external_provider: "manual", external_opportunity_id: id,
    })
    // Retrying the same submission must not create a second card or overwrite it.
    if (error && error.code !== "23505") return { error: "Unable to add this opportunity. Your entries are still here." }
    const { data, error: readError } = await admin.from("organization_finance_opportunities")
      .select("*").eq("id", id).eq("org_id", activeOrg.orgId).eq("external_provider", "manual").maybeSingle()
    if (readError || !data || !["new", "saved", "applied", "awarded", "not_awarded"].includes(data.status)) return { error: "Unable to confirm this opportunity. Try again." }
    const opportunity: WorkspaceFinanceOpportunityInput = {
      id: data.id, title: data.title, source: data.source_label, dueAt: data.due_at,
      discoveredAt: data.discovered_at, status: data.status as WorkspaceFinanceOpportunityInput["status"],
    }
    revalidatePath("/workspace")
    revalidatePath("/my-organization")
    revalidatePath("/organization/workspace")
    return { opportunity }
  } catch {
    return { error: "Unable to add this opportunity. Your entries are still here." }
  }
}
