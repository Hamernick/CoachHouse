import { cache } from "react"
import { hasCoachCoachingAccess } from "@/features/platform-access"
import { hasWorkspaceSupportAccess } from "@/lib/organization/support-access"

import { fetchSidebarTree, type SidebarClass } from "@/lib/academy"
import {
  fetchLearningEntitlements,
  type LearningEntitlements,
} from "@/lib/accelerator/entitlements"
import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { resolveAccountBillingCancellationRisk } from "@/lib/billing/subscription-access"
import {
  resolvePricingPlanTier,
  type PricingPlanTier,
} from "@/lib/billing/plan-tier"
import { loadAppPricingFeedbackPrompt } from "@/features/app-pricing-feedback"
import { loadAccessibleOrganizations } from "@/features/member-workspace/server"
import { publicSharingEnabled } from "@/lib/feature-flags"
import type { Json } from "@/lib/supabase"
import { buildSavedOnboardingFlowDefaults } from "@/lib/onboarding/saved-defaults"
import { resolveOnboardingRequirements } from "@/lib/onboarding/requirements"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import { shouldForceStripeEntitlementSyncForWorkspace } from "@/lib/workspace/member-workspace-nav-access"
import {
  EMPTY_STATE,
  type DashboardLayoutState,
} from "./dashboard-layout-state-types"

export type { DashboardLayoutState } from "./dashboard-layout-state-types"

const resolveDashboardLayoutStateCached = cache(
  async (): Promise<DashboardLayoutState> => {
    const requestContext = await resolveOptionalAuthenticatedAppContext()

    if (!requestContext) {
      return EMPTY_STATE
    }

    const { supabase, user, profileAudience, activeOrg } = requestContext

    let displayName: string | null = null
    let email: string | null = user.email ?? null
    let avatar: string | null = null
    let isAdmin = false
    let isPlatformStaff = false
    let platformAccessLevel: DashboardLayoutState["platformAccessLevel"] = null
    let isTester = false
    let needsOnboarding = false
    let acceleratorProgress: number | null = null
    let showLiveBadges = false
    let showAccelerator = false
    let tutorialWelcomePlatform = false
    let tutorialWelcomeAccelerator = false
    let appPricingFeedbackPrompt: DashboardLayoutState["appPricingFeedbackPrompt"] =
      null
    let hasActiveSubscription = false
    let hasBillingCancellationRisk = false
    let hasAcceleratorAccess = false
    let hasElectiveAccess = false
    let ownedElectiveModuleSlugs: string[] = []
    let showOrgAdmin = false
    let canAccessOrgAdmin = false
    let formationStatus: string | null = null
    let organizationName: string | null = null
    let currentPlanTier: PricingPlanTier = "free"
    let showMemberWorkspace = false
    let memberWorkspaceHeader: DashboardLayoutState["memberWorkspaceHeader"] =
      null

    const userMeta =
      (user.user_metadata as Record<string, unknown> | null) ?? null
    const metadataFirstName =
      typeof userMeta?.first_name === "string" ? userMeta.first_name.trim() : ""
    const metadataLastName =
      typeof userMeta?.last_name === "string" ? userMeta.last_name.trim() : ""
    const metadataFullName = [metadataFirstName, metadataLastName]
      .filter(Boolean)
      .join(" ")
      .trim()
    const metadataAvatarUrl =
      (typeof userMeta?.avatar_url === "string" &&
      userMeta.avatar_url.trim().length > 0
        ? userMeta.avatar_url
        : null) ??
      (typeof userMeta?.picture === "string" &&
      userMeta.picture.trim().length > 0
        ? userMeta.picture
        : null) ??
      (typeof userMeta?.avatar === "string" && userMeta.avatar.trim().length > 0
        ? userMeta.avatar
        : null)
    const completed = Boolean(userMeta?.onboarding_completed)
    const metadataIntentFocus =
      typeof userMeta?.onboarding_intent_focus === "string"
        ? userMeta.onboarding_intent_focus
        : null
    const metadataRoleInterest =
      typeof userMeta?.onboarding_role_interest === "string"
        ? userMeta.onboarding_role_interest
        : null
    const metadataPhone =
      typeof userMeta?.phone === "string" ? userMeta.phone.trim() : ""
    const metadataOptInUpdates =
      typeof userMeta?.marketing_opt_in === "boolean"
        ? userMeta.marketing_opt_in
        : null
    const metadataNewsletterOptIn =
      typeof userMeta?.newsletter_opt_in === "boolean"
        ? userMeta.newsletter_opt_in
        : null

    displayName =
      profileAudience.fullName ??
      (typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null) ??
      (metadataFullName || null)
    isAdmin = profileAudience.isAdmin
    isPlatformStaff = profileAudience.isPlatformStaff || profileAudience.isAdmin
    platformAccessLevel =
      profileAudience.platformAccessLevel ??
      (profileAudience.isAdmin ? "developer" : null)
    isTester = profileAudience.isTester

    if (!email && typeof user.user_metadata?.email === "string") {
      email = user.user_metadata.email as string
    }

    avatar = profileAudience.avatarUrl ?? metadataAvatarUrl

    const { orgId, role } = activeOrg
    showOrgAdmin = role === "owner" || role === "admin"
    if (isAdmin) {
      showOrgAdmin = true
    }

    const accessibleOrganizationsPromise =
      (metadataIntentFocus !== "fund" || isPlatformStaff)
        ? loadAccessibleOrganizations(supabase, user.id)
        : Promise.resolve([])
    const appPricingFeedbackPromptPromise = loadAppPricingFeedbackPrompt({
      supabase,
      userId: user.id,
    })
    const entitlementFallback: LearningEntitlements = {
      hasAcceleratorPurchase: false,
      hasActiveSubscription: false,
      hasAcceleratorAccess: false,
      hasElectiveAccess: false,
      ownedElectiveModuleSlugs: [],
    }
    const entitlementsPromise =
      platformAccessLevel === "coach"
        ? Promise.resolve(entitlementFallback)
        : fetchLearningEntitlements({
            supabase,
            userId: user.id,
            orgUserId: orgId,
            isAdmin,
            forceStripeSync: shouldForceStripeEntitlementSyncForWorkspace({
              isAdmin,
            }),
          }).catch((error: unknown) => {
            console.warn("Unable to load dashboard entitlement state.", error)
            return entitlementFallback
          })

    const [
      accessibleOrganizations,
      orgRowResult,
      entitlements,
      resolvedPricingFeedbackPrompt,
      accountBillingResult,
    ] = await Promise.all([
      accessibleOrganizationsPromise,
      supabase
        .from("organizations")
        .select("profile, public_slug, is_public, is_public_roadmap")
        .eq("user_id", orgId)
        .maybeSingle<{
          profile: Json | null
          public_slug: string | null
          is_public: boolean | null
          is_public_roadmap: boolean | null
        }>(),
      entitlementsPromise,
      appPricingFeedbackPromptPromise,
      resolveAccountBillingCancellationRisk({
        supabase,
        userId: user.id,
      }),
    ])

    appPricingFeedbackPrompt = resolvedPricingFeedbackPrompt
    hasBillingCancellationRisk =
      "error" in accountBillingResult
        ? false
        : accountBillingResult.hasBillingCancellationRisk

    if (orgRowResult.error) {
      throw supabaseErrorToError(orgRowResult.error, "Unable to load organization setup.")
    }
    const orgProfile =
      (orgRowResult.data?.profile as Record<string, unknown> | null) ?? null
    const orgPeople = Array.isArray(orgProfile?.org_people)
      ? (orgProfile.org_people as Array<Record<string, unknown>>)
      : []
    const orgSlug =
      typeof orgRowResult.data?.public_slug === "string"
        ? orgRowResult.data.public_slug.trim()
        : ""
    const fs =
      typeof orgProfile?.formationStatus === "string"
        ? orgProfile.formationStatus
        : null
    formationStatus = fs
    const orgName =
      typeof orgProfile?.name === "string" ? orgProfile.name.trim() : ""
    organizationName = orgName.length > 0 ? orgName : null
    const onboarding = resolveOnboardingRequirements({
      userId: user.id,
      organizationId: orgId,
      isPlatformStaff,
      userMetadata: userMeta,
      organizationProfile: orgProfile,
      publicSlug: orgSlug,
    })
    needsOnboarding = onboarding.required
    const onboardingDefaults = await buildSavedOnboardingFlowDefaults({
      organizationId: orgId,
      supabase,
      needsOnboarding,
      userId: user.id,
      email,
      displayName,
      avatarUrl: avatar,
      profileTitle: profileAudience.headline,
      userMetadata: userMeta,
      orgProfile,
      orgSlug,
    })

    if (publicSharingEnabled) {
      const hasSlug = Boolean(
        orgRowResult.data?.public_slug &&
        orgRowResult.data.public_slug.trim().length > 0
      )
      showLiveBadges =
        hasSlug &&
        Boolean(orgRowResult.data?.is_public) &&
        Boolean(orgRowResult.data?.is_public_roadmap)
    }

    hasActiveSubscription = entitlements.hasActiveSubscription
    hasAcceleratorAccess = entitlements.hasAcceleratorAccess
    hasElectiveAccess = entitlements.hasElectiveAccess
    ownedElectiveModuleSlugs = entitlements.ownedElectiveModuleSlugs
    showAccelerator = hasAcceleratorAccess || hasElectiveAccess
    showMemberWorkspace =
      isPlatformStaff || hasActiveSubscription || orgId !== user.id
    canAccessOrgAdmin = showOrgAdmin && showMemberWorkspace

    if ((metadataIntentFocus !== "fund" || isPlatformStaff) && showMemberWorkspace) {
      const resolvedActiveOrganization =
        accessibleOrganizations.find(
          (organization) => organization.orgId === orgId
        ) ??
        accessibleOrganizations[0] ??
        null

      if (resolvedActiveOrganization) {
        memberWorkspaceHeader = {
          activeOrganization: { ...resolvedActiveOrganization, supportAccess: activeOrg.supportAccess },
          presenceOrganizationId: orgRowResult.data ? orgId : undefined,
          canSearchSupport: await hasWorkspaceSupportAccess(supabase),
          accessibleOrganizations,
        }
      }
    }

    if (hasActiveSubscription) {
      const { data: activeSubscription } = await supabase
        .from("subscriptions")
        .select("status, metadata")
        .eq("user_id", orgId)
        .in("status", ["active", "trialing", "past_due", "incomplete"])
        .not("stripe_subscription_id", "ilike", "stub_%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ status: string | null; metadata: Json | null }>()

      currentPlanTier = resolvePricingPlanTier(activeSubscription ?? null)
      if (currentPlanTier === "free") {
        currentPlanTier = "organization"
      }
    }

    const tutorialsCompleted = Array.isArray(userMeta?.tutorials_completed)
      ? (userMeta?.tutorials_completed as unknown[]).filter(
          (value): value is string => typeof value === "string"
        )
      : []
    const tutorialsDismissed = Array.isArray(userMeta?.tutorials_dismissed)
      ? (userMeta?.tutorials_dismissed as unknown[]).filter(
          (value): value is string => typeof value === "string"
        )
      : []

    const welcomeEligible = !needsOnboarding && !isPlatformStaff && completed
    tutorialWelcomePlatform =
      welcomeEligible &&
      !tutorialsCompleted.includes("platform") &&
      !tutorialsDismissed.includes("platform")
    tutorialWelcomeAccelerator =
      welcomeEligible &&
      showAccelerator &&
      !tutorialsCompleted.includes("accelerator") &&
      !tutorialsDismissed.includes("accelerator")

    let sidebarTree: SidebarClass[] = []
    if (isAdmin || showAccelerator) {
      sidebarTree = await fetchSidebarTree({
        includeDrafts: isAdmin,
        forceAdmin: isAdmin,
      })
    }

    return {
      userPresent: true,
      sidebarTree,
      user: {
        name: displayName,
        title:
          profileAudience.headline ?? onboardingDefaults.defaultTitle ?? null,
        email,
        avatar,
      },
      isAdmin,
      platformAccessLevel,
      hasCoachingAccess: hasCoachCoachingAccess(user.app_metadata),
      isTester,
      showOrgAdmin,
      canAccessOrgAdmin,
      acceleratorProgress,
      showAccelerator,
      showLiveBadges,
      hasActiveSubscription,
      hasBillingCancellationRisk,
      hasAcceleratorAccess,
      hasElectiveAccess,
      ownedElectiveModuleSlugs,
      currentPlanTier,
      showMemberWorkspace,
      organizationName,
      tutorialWelcome: {
        platform: tutorialWelcomePlatform,
        accelerator: tutorialWelcomeAccelerator,
      },
      appPricingFeedbackPrompt,
      onboardingDefaults: {
        open: needsOnboarding,
        ...onboardingDefaults,
      },
      onboardingLocked: needsOnboarding,
      onboardingMode: onboarding.mode,
      onboardingIntentFocus:
        metadataIntentFocus === "build" ||
        metadataIntentFocus === "find" ||
        metadataIntentFocus === "fund" ||
        metadataIntentFocus === "support"
          ? metadataIntentFocus
          : null,
      formationStatus,
      organizationScope: { orgId, actorId: user.id, supportAccess: activeOrg.supportAccess, presenceOrganizationId: orgRowResult.data ? orgId : undefined },
      memberWorkspaceHeader,
      memberMapOnboarding: {
        hasOrganizationSwitcher: accessibleOrganizations.length > 1,
      },
    }
  }
)

export async function resolveDashboardLayoutState(): Promise<DashboardLayoutState> {
  return resolveDashboardLayoutStateCached()
}
