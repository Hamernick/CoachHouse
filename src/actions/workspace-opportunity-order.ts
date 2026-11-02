"use server"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import { canManageWorkspaceFinance } from "@/lib/workspace/workspace-finance-access"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const ids = z.array(z.uuid()).min(2).max(200)
const schema = z.object({ organizationId: z.uuid(), previous: ids, ordered: ids }).strict().refine(value =>
  value.previous.length === value.ordered.length && new Set(value.previous).size === value.previous.length &&
  new Set(value.ordered).size === value.ordered.length && value.ordered.every(id => value.previous.includes(id)))
const receipt = z.array(z.object({ id: z.uuid(), feedPosition: z.number().int().nonnegative().safe(), updatedAt: z.string() }))

export async function reorderWorkspaceOpportunities(input: { organizationId: string; previous: string[]; ordered: string[] }) {
  if (!schema.safeParse(input).success) return { error: "Invalid opportunity order." } as const
  try {
    const { activeOrg, supabase, user } = await resolveAuthenticatedAppContext()
    if (activeOrg.orgId !== input.organizationId || !(await canManageWorkspaceFinance({ activeOrg, supabase, userId: user.id }))) return { error: "You can’t reorder opportunities in this organization." } as const
    const { data, error } = await createSupabaseAdminClient().rpc("reorder_opportunity_feed", { p_org_id: activeOrg.orgId, p_previous: input.previous, p_ordered: input.ordered })
    const parsed = receipt.safeParse(data)
    if (error || !parsed.success) return { error: "The opportunity order changed or couldn’t be saved. Reload and try again." } as const
    revalidatePath("/workspace"); revalidatePath("/my-organization")
    return { items: parsed.data }
  } catch { return { error: "Opportunity order couldn’t be saved. Try again." } as const }
}
