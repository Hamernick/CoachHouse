"use server"

import { z } from "zod"
import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import { canManageWorkspaceFinance } from "@/lib/workspace/workspace-finance-access"
import { discoverOfficialOpportunities } from "./server/opportunity-discovery"
import { opportunityValueLabel } from "./lib/opportunity-matching"
import type { OpportunitySourceOption } from "./lib/opportunity-sources"

const inputSchema = z.strictObject({ organizationId: z.uuid(), keyword: z.string().trim().min(2).max(100) })
// Bounded, per-instance burst protection; discovery also caps time, bytes and requests.
const windows = new Map<string, { expires: number; count: number }>()
export async function searchOpportunityFundingSources(input: unknown): Promise<{ options: OpportunitySourceOption[] } | { error: string }> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { error: "Use 2–100 characters to search grants." }
  try {
    const { activeOrg, supabase, user } = await resolveAuthenticatedAppContext()
    if (activeOrg.orgId !== parsed.data.organizationId || !await canManageWorkspaceFinance({ activeOrg, supabase, userId: user.id })) return { error: "You don’t have access to add funding sources here." }
    const now = Date.now()
    for (const [key, window] of windows) if (window.expires <= now) windows.delete(key)
    const window = windows.get(user.id) ?? { expires: now + 60_000, count: 0 }
    if (window.count >= 10 || (!windows.has(user.id) && windows.size >= 1000)) return { error: "Search limit reached. Try again shortly." }
    window.count++; windows.set(user.id, window)
    // Only the explicitly submitted keyword goes to the public provider.
    const result = await discoverOfficialOpportunities({ keyword: parsed.data.keyword, limit: 3 })
    if (result.unavailable && !result.notices.length) return { error: "Grants.gov is unavailable. Try again." }
    return { options: result.notices.map(notice => ({
      source: { kind: "link", url: notice.originalUrl, title: notice.title.slice(0, 240) },
      title: notice.title.slice(0, 240), category: "Funding link", href: notice.originalUrl,
      description: `${notice.agency} · ${opportunityValueLabel(notice)}`,
    })) }
  } catch { return { error: "Grants.gov couldn’t be searched. Try again." } }
}
