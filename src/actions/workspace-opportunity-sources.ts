"use server"
import { z } from "zod"
import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import { loadOpportunitySourceOptions } from "@/features/workspace-finance/server"
import { fetchPublicPageMetadata } from "@/lib/editor/public-page-metadata"

const previewWindows = new Map<string, { expires: number; count: number }>()

export async function getWorkspaceOpportunitySources(organizationId: string) {
  try {
    if (!z.uuid().safeParse(organizationId).success) return { error: "Invalid organization." } as const
    const { activeOrg, supabase, user } = await resolveAuthenticatedAppContext()
    if (activeOrg.orgId !== organizationId) return { error: "Your organization changed. Reopen Sources." } as const
    return { options: await loadOpportunitySourceOptions(supabase, organizationId, user.id) }
  } catch { return { error: "Sources couldn’t be loaded. Try typing @ again." } as const }
}

export async function previewOpportunityLink(organizationId: string, url: string) {
  try {
    const { activeOrg, user } = await resolveAuthenticatedAppContext()
    if (activeOrg.orgId !== organizationId) return { error: "Preview unavailable." } as const
    const now = Date.now()
    for (const [key, window] of previewWindows) if (window.expires <= now) previewWindows.delete(key)
    const window = previewWindows.get(user.id) ?? { expires: now + 60_000, count: 0 }
    if (window.count >= 20 || previewWindows.size >= 1000) return { error: "Preview limit reached. Try again shortly." } as const
    window.count += 1; previewWindows.set(user.id, window)
    return { metadata: await fetchPublicPageMetadata(url) }
  } catch { return { error: "Preview unavailable. You can still open the link." } as const }
}
