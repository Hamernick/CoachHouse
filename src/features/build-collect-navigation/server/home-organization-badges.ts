import "server-only"
import { unstable_cache } from "next/cache"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { env } from "@/lib/env"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import { hasActivePaidBadgeSubscription, hasCompleteNonprofitBadgeProfile, type BadgeSubscription } from "../lib/home-organization-badge"

// Only this derived flag reaches the public client, never subscription metadata.
const loadPaidOrganizationIds = unstable_cache(async (ids: string[]) => {
  const paidIds: string[] = []
  const supabase = createSupabaseAdminClient()
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await supabase.from("subscriptions")
      .select("user_id, status, metadata, stripe_subscription_id, current_period_end, created_at")
      .in("user_id", ids.slice(offset, offset + 100))
      .not("stripe_subscription_id", "ilike", "stub_%")
      .order("created_at", { ascending: false })
      .returns<Array<BadgeSubscription & { user_id: string }>>()
    if (error) throw new Error("Unable to resolve public organization badges")
    // Match the platform's latest-subscription policy; do not revive an older plan.
    const seen = new Set<string>()
    for (const row of data ?? []) {
      if (seen.has(row.user_id)) continue
      seen.add(row.user_id)
      if (hasActivePaidBadgeSubscription(row)) paidIds.push(row.user_id)
    }
  }
  return paidIds
}, ["home-paid-organization-badges-v1"], { revalidate: 300, tags: ["public-map-organizations"] })

export async function getHomeOrganizationBadgeIds(organizations: PublicMapOrganization[]) {
  const ids = organizations.filter(hasCompleteNonprofitBadgeProfile).map((organization) => organization.id).sort()
  if (!ids.length || !env.SUPABASE_SERVICE_ROLE_KEY) return new Set<string>()
  try { return new Set(await loadPaidOrganizationIds(ids)) }
  catch { return new Set<string>() } // Fail closed without blocking resource discovery.
}
