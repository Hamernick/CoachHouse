import { redirect } from "next/navigation"

import { OnboardingWorkspaceCard } from "@/components/onboarding/onboarding-workspace-card"
import { fetchLearningEntitlements } from "@/lib/accelerator/entitlements"
import { resolvePricingPlanTier, type PricingPlanTier } from "@/lib/billing/plan-tier"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import type { Json } from "@/lib/supabase"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { resolveDashboardLayoutState } from "@/components/app-shell/dashboard-layout-state"
import { completeOnboardingAction } from "./actions"

export const dynamic = "force-dynamic"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

async function resolvePricingReturnPlanTierOverride(
  state: Awaited<ReturnType<typeof resolveDashboardLayoutState>>,
  searchParams?: SearchParams,
): Promise<PricingPlanTier | null> {
  const params = searchParams ? await searchParams : {}
  const source = typeof params?.source === "string" ? params.source : null
  if (source !== "onboarding_pricing") return null
  if (!state.userPresent || !state.onboardingLocked || state.isAdmin) return null
  if (state.onboardingIntentFocus !== "build") return null
  if (state.currentPlanTier !== "free") return state.currentPlanTier

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { orgId } = await resolveActiveOrganization(supabase, user.id)
  const entitlements = await fetchLearningEntitlements({
    supabase,
    userId: user.id,
    orgUserId: orgId,
    isAdmin: state.isAdmin,
    forceStripeSync: true,
  })
  if (!entitlements.hasActiveSubscription) return null

  const { data: activeSubscription } = await supabase
    .from("subscriptions")
    .select("status, metadata")
    .eq("user_id", orgId)
    .in("status", ["active", "trialing", "past_due", "incomplete"])
    .not("stripe_subscription_id", "ilike", "stub_%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ status: string | null; metadata: Json | null }>()

  const resolvedPlanTier = resolvePricingPlanTier(activeSubscription ?? null)
  return resolvedPlanTier === "free" ? "organization" : resolvedPlanTier
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: SearchParams
} = {}) {
  const state = await resolveDashboardLayoutState()
  const pricingReturnPlanTierOverride = await resolvePricingReturnPlanTierOverride(
    state,
    searchParams,
  )

  if (!state.userPresent) {
    redirect("/login?redirect=/onboarding")
  }

  if (!state.onboardingLocked) {
    redirect("/workspace")
  }

  return (
    <div data-onboarding-page className="mx-auto flex w-full max-w-[980px] min-h-0 flex-1 flex-col py-0 sm:py-2 md:py-4">
      <OnboardingWorkspaceCard
        className="mx-auto my-auto h-auto max-h-none shrink-0 shadow-none [&>form]:h-auto max-w-[480px]"
        {...state.onboardingDefaults}
        defaultBuilderPlanTier={pricingReturnPlanTierOverride ?? state.currentPlanTier}
        mode={state.onboardingMode ?? "post_signup_access"}
        onSubmit={completeOnboardingAction}
      />
    </div>
  )
}
