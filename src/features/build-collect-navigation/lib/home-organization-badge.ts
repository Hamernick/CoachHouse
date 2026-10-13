import { resolvePaidPlanTierFromMetadata } from "@/lib/billing/plan-tier"
import { organizationNarrativeHtmlToPlainText } from "@/lib/roadmap"
import type { Json } from "@/lib/supabase"

type BadgeProfile = { vision: string | null; mission: string | null; values: string | null; formationStatus: string | null }
export type BadgeSubscription = {
  status: string | null
  metadata: Json | null
  stripe_subscription_id: string | null
  current_period_end: string | null
}

export function hasCompleteNonprofitBadgeProfile(profile: BadgeProfile) {
  return profile.formationStatus === "approved" && [profile.vision, profile.mission, profile.values].every((value) =>
    typeof value === "string" && organizationNarrativeHtmlToPlainText(value).replace(/[\s\u200B-\u200D\uFEFF]/g, "").length > 0
  )
}

export function hasActivePaidBadgeSubscription(subscription: BadgeSubscription, now = Date.now()) {
  const metadata = subscription.metadata
  const isLive = metadata !== null && typeof metadata === "object" && !Array.isArray(metadata) && metadata.stripe_mode === "live"
  const periodEnd = Date.parse(subscription.current_period_end ?? "")
  return subscription.status === "active" && isLive &&
    Boolean(subscription.stripe_subscription_id?.startsWith("sub_")) &&
    resolvePaidPlanTierFromMetadata(metadata) !== null &&
    Number.isFinite(periodEnd) && periodEnd > now
}
